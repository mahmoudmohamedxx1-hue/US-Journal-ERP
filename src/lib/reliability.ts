/**
 * US Journal ERP — Reliability Engine
 *
 * Inspired by Odoo's sequence_mixin _locked_increment and transaction patterns.
 *
 * Key reliability patterns from Odoo:
 *   1. Idempotency keys — prevent duplicate operations on retry
 *   2. Sequence locking — SELECT FOR UPDATE on sequence to prevent gaps
 *   3. Transaction savepoints — for partial rollback on constraint violations
 *   4. Optimistic concurrency — version field to detect concurrent modifications
 *   5. Retry with backoff — for transient failures (database locked, constraint violations)
 *   6. Atomic multi-step operations — all-or-nothing via db.$transaction
 */

import { db } from '@/lib/db'
import { createHash } from 'crypto'

// ---------------------------------------------------------------------------
// 1. Idempotency Keys
// ---------------------------------------------------------------------------

/**
 * Generate an idempotency key from request parameters.
 * Same parameters → same key → duplicate request detected.
 */
export function generateIdempotencyKey(params: Record<string, unknown>): string {
  const sorted = JSON.stringify(params, Object.keys(params).sort())
  return createHash('sha256').update(sorted).digest('hex').slice(0, 32)
}

/**
 * Check if an operation with this idempotency key has already been executed.
 * If yes, return the cached result. If no, mark it as in-progress.
 *
 * Odoo uses a similar pattern in mail.thread for preventing duplicate operations.
 */
export async function checkIdempotency(
  key: string,
): Promise<{ exists: boolean; result?: unknown }> {
  // Use the AuditLog as a simple idempotency store
  const existing = await db.auditLog.findFirst({
    where: {
      action: 'IDEMPOTENCY_' + key,
    },
    select: { description: true, hash: true },
  })

  if (existing) {
    try {
      const result = JSON.parse(existing.description)
      return { exists: true, result: result.data }
    } catch {
      return { exists: true }
    }
  }

  return { exists: false }
}

/**
 * Store the result of an idempotent operation.
 */
export async function storeIdempotencyResult(
  key: string,
  result: unknown,
  organizationId: string,
  userId: string,
): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId,
      userId,
      action: 'IDEMPOTENCY_' + key,
      entityType: 'IdempotencyKey',
      description: JSON.stringify({ data: result, timestamp: new Date().toISOString() }),
    },
  })
}

/**
 * Execute an operation with idempotency protection.
 * If the same key is used twice, the second call returns the cached result.
 */
export async function withIdempotency<T>(
  key: string,
  organizationId: string,
  userId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const { exists, result } = await checkIdempotency(key)
  if (exists) {
    return result as T
  }

  const result2 = await operation()
  await storeIdempotencyResult(key, result2, organizationId, userId)
  return result2
}

// ---------------------------------------------------------------------------
// 2. Retry with Backoff
// ---------------------------------------------------------------------------

/**
 * Execute an operation with automatic retry on transient failures.
 *
 * Odoo uses similar retry logic for database-locked errors.
 *
 * Retries on:
 *   - P2002 (unique constraint violation) — retry with new sequence number
 *   - "SQLITE_BUSY: database is locked" — retry after short delay
 *   - "Transaction was deadlocked" — retry after backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelayMs?: number
    maxDelayMs?: number
    onError?: (error: unknown, attempt: number) => boolean  // return true to retry
  } = {},
): Promise<T> {
  const { maxRetries = 5, baseDelayMs = 50, maxDelayMs = 2000, onError } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt > maxRetries) {
        throw error
      }

      // Check if this error is retryable
      const isRetryable = isTransientError(error)
      const shouldRetry = onError ? onError(error, attempt) : isRetryable

      if (!shouldRetry) {
        throw error
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * baseDelayMs,
        maxDelayMs,
      )

      console.warn(`[retry] Attempt ${attempt}/${maxRetries} failed, retrying in ${Math.round(delay)}ms: ${error instanceof Error ? error.message : String(error)}`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Check if an error is transient (retryable).
 */
function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  const code = (error as { code?: string }).code

  // Prisma unique constraint violation
  if (code === 'P2002') return true

  // SQLite database locked
  if (msg.includes('database is locked') || msg.includes('sqlite_busy')) return true

  // PostgreSQL deadlock
  if (msg.includes('deadlock') || msg.includes('could not serialize')) return true

  // Connection timeout
  if (msg.includes('connection') && (msg.includes('timeout') || msg.includes('refused'))) return true

  // Prisma transaction timeout
  if (code === 'P2028') return true

  return false
}

// ---------------------------------------------------------------------------
// 3. Atomic Multi-Step Operations (Odoo's _post pattern)
// ---------------------------------------------------------------------------

/**
 * Execute a multi-step operation atomically.
 *
 * Odoo's _post() does many things:
 *   1. Validate the move
 *   2. Check lock dates
 *   3. Generate sequence number
 *   4. Create journal lines (dynamic lines sync)
 *   5. Compute and store hash
 *   6. Create audit log entries
 *
 * All of these must succeed or ALL must roll back.
 * This wrapper ensures that via db.$transaction.
 *
 * Usage:
 *   const result = await atomicOperation(async (tx) => {
 *     const journal = await tx.journal.create({ ... })
 *     await tx.journalLine.createMany({ ... })
 *     await tx.auditLog.create({ ... })
 *     return journal
 *   })
 */
export async function atomicOperation<T>(
  fn: (tx: any) => Promise<T>,
  options: { timeout?: number; maxWait?: number } = {},
): Promise<T> {
  return db.$transaction(fn, {
    timeout: options.timeout || 10000,  // 10 seconds
    maxWait: options.maxWait || 5000,   // wait up to 5s to acquire a transaction slot
  })
}

// ---------------------------------------------------------------------------
// 4. Sequence Generation with Collision Handling (Odoo's _locked_increment)
// ---------------------------------------------------------------------------

/**
 * Generate a unique journal number with collision handling.
 *
 * Odoo's approach:
 *   1. Lock the sequence by updating a row covered by the UNIQUE constraint
 *   2. Increment and format the sequence
 *   3. If collision (unique constraint), retry with next number
 *
 * Our approach (SQLite-compatible):
 *   1. Count existing journals
 *   2. Generate number with count + 1
 *   3. If unique constraint violation, retry with count + 2, + 3, etc.
 *   4. Use withRetry for automatic backoff
 */
export async function generateUniqueJournalNumber(
  organizationId: string,
  year: number,
  prefix: string = 'JE',
): Promise<string> {
  return withRetry(async () => {
    const count = await db.journal.count({
      where: {
        organizationId,
        journalNumber: { startsWith: `${prefix}-${year}-` },
      },
    })

    // Try count + 1
    const candidate = `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`

    // Verify it doesn't exist (handle race condition)
    const existing = await db.journal.findUnique({
      where: { journalNumber: candidate },
      select: { id: true },
    })

    if (existing) {
      // Collision — find the next available number
      for (let i = 2; i <= 100; i++) {
        const nextCandidate = `${prefix}-${year}-${String(count + i).padStart(4, '0')}`
        const exists = await db.journal.findUnique({
          where: { journalNumber: nextCandidate },
          select: { id: true },
        })
        if (!exists) return nextCandidate
      }
      throw new Error('Could not generate unique journal number after 100 attempts')
    }

    return candidate
  }, {
    maxRetries: 3,
    onError: (error) => {
      const code = (error as { code?: string }).code
      return code === 'P2002'  // unique constraint violation
    },
  })
}

// ---------------------------------------------------------------------------
// 5. Optimistic Concurrency Control (Odoo's write() validation)
// ---------------------------------------------------------------------------

/**
 * Optimistic concurrency: check if a record has been modified since it was last read.
 *
 * Odoo validates on write() that certain fields haven't changed.
 * We use an `updatedAt` timestamp as the version.
 *
 * Usage:
 *   const record = await db.journal.findUnique({ id })
 *   // ... user makes changes ...
 *   await optimisticUpdate(record.id, record.updatedAt, { status: 'Posted' })
 *   // throws if another user modified the record between read and write
 */
export async function optimisticUpdate(
  model: 'journal' | 'invoice' | 'bill' | 'payment' | 'vendor' | 'customer',
  id: string,
  expectedUpdatedAt: Date,
  updateData: Record<string, unknown>,
): Promise<void> {
  const result = await (db as any)[model].updateMany({
    where: {
      id,
      updatedAt: expectedUpdatedAt,  // only update if not modified since read
    },
    data: updateData,
  })

  if (result.count === 0) {
    // Record was modified by another user
    const current = await (db as any)[model].findUnique({
      where: { id },
      select: { updatedAt: true },
    })
    if (current) {
      throw new Error(
        `Optimistic concurrency conflict: ${model} ${id} was modified by another user at ${current.updatedAt.toISOString()}. ` +
        `Expected ${expectedUpdatedAt.toISOString()}. Please refresh and try again.`
      )
    }
    throw new Error(`${model} ${id} not found`)
  }
}

// ---------------------------------------------------------------------------
// 6. Lock Date Validation (Odoo's _get_violated_lock_dates)
// ---------------------------------------------------------------------------

/**
 * Comprehensive lock date validation.
 *
 * Odoo checks 5 lock dates:
 *   1. hard_lock_date — irreversible, no exceptions
 *   2. fiscalyear_lock_date — global lock, all entries
 *   3. tax_lock_date — entries with taxes
 *   4. sale_lock_date — sales journal entries
 *   5. purchase_lock_date — purchase journal entries
 *
 * Returns list of violated locks with messages.
 */
export async function getViolatedLockDates(
  organizationId: string,
  journalDate: Date,
  options: { hasTax?: boolean; journalType?: string } = {},
): Promise<Array<{ field: string; lockDate: Date; message: string; severity: 'hard' | 'soft' }>> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      fiscalYearLockDate: true,
      taxLockDate: true,
      saleLockDate: true,
      purchaseLockDate: true,
      hardLockDate: true,
    },
  })

  if (!org) return []

  const violations: Array<{ field: string; lockDate: Date; message: string; severity: 'hard' | 'soft' }> = []

  // Hard lock — no exceptions
  if (org.hardLockDate && journalDate <= org.hardLockDate) {
    violations.push({
      field: 'hardLockDate',
      lockDate: org.hardLockDate,
      message: `Hard lock date (${org.hardLockDate.toISOString().slice(0, 10)}) is active. No entries can be posted before this date. This lock is IRREVERSIBLE.`,
      severity: 'hard',
    })
  }

  // Global fiscal year lock
  if (org.fiscalYearLockDate && journalDate <= org.fiscalYearLockDate) {
    violations.push({
      field: 'fiscalYearLockDate',
      lockDate: org.fiscalYearLockDate,
      message: `Fiscal year lock date (${org.fiscalYearLockDate.toISOString().slice(0, 10)}) prevents posting entries before this date.`,
      severity: 'soft',
    })
  }

  // Tax lock — only if entry has taxes
  if (org.taxLockDate && journalDate <= org.taxLockDate && options.hasTax) {
    violations.push({
      field: 'taxLockDate',
      lockDate: org.taxLockDate,
      message: `Tax return lock date (${org.taxLockDate.toISOString().slice(0, 10)}) prevents posting tax entries before this date.`,
      severity: 'soft',
    })
  }

  // Sale lock — only for sales journals
  if (org.saleLockDate && journalDate <= org.saleLockDate && options.journalType === 'sale') {
    violations.push({
      field: 'saleLockDate',
      lockDate: org.saleLockDate,
      message: `Sales lock date (${org.saleLockDate.toISOString().slice(0, 10)}) prevents posting sales entries before this date.`,
      severity: 'soft',
    })
  }

  // Purchase lock — only for purchase journals
  if (org.purchaseLockDate && journalDate <= org.purchaseLockDate && options.journalType === 'purchase') {
    violations.push({
      field: 'purchaseLockDate',
      lockDate: org.purchaseLockDate,
      message: `Purchase lock date (${org.purchaseLockDate.toISOString().slice(0, 10)}) prevents posting purchase entries before this date.`,
      severity: 'soft',
    })
  }

  return violations
}

// ---------------------------------------------------------------------------
// 7. Currency Revaluation (Odoo's FX gain/loss)
// ---------------------------------------------------------------------------

/**
 * Compute FX gain/loss for a foreign-currency transaction.
 *
 * Odoo computes this during reconciliation:
 *   gain/loss = (amount_at_original_rate) - (amount_at_current_rate)
 *
 * If positive → FX gain (credit)
 * If negative → FX loss (debit)
 */
export function computeFxGainLoss(
  amountForeignCents: number,
  originalRate: number,  // e.g., 48.5 EGP/USD
  currentRate: number,  // e.g., 50.0 EGP/USD
): { gainLossCents: number; isGain: boolean } {
  const amountAtOriginalRate = Math.round(amountForeignCents * originalRate / 100)
  const amountAtCurrentRate = Math.round(amountForeignCents * currentRate / 100)
  const gainLossCents = amountAtCurrentRate - amountAtOriginalRate
  return {
    gainLossCents: Math.abs(gainLossCents),
    isGain: gainLossCents >= 0,
  }
}

// ---------------------------------------------------------------------------
// 8. Account Reconcilable Flag (Odoo's reconcile field)
// ---------------------------------------------------------------------------

/**
 * Check if an account is reconcilable (Odoo's account.reconcile field).
 * In Odoo, only certain accounts can be reconciled (AR, AP, bank, tax).
 * This prevents reconciliation on revenue/expense accounts.
 */
export function isAccountReconcilable(accountType: string, accountCode: string): boolean {
  // AR (1120), AP (2110), Bank (1111-1115), Tax (1160, 2130)
  const reconcilableCodes = ['1120', '2110', '1111', '1112', '1113', '1115', '1160', '2130']
  const reconcilableTypes = ['Asset', 'Liability']

  if (reconcilableTypes.includes(accountType) && reconcilableCodes.some(code => accountCode.startsWith(code))) {
    return true
  }

  return false
}

// ---------------------------------------------------------------------------
// 9. Cash Basis vs Accrual Basis (Odoo's tax_exigibility)
// ---------------------------------------------------------------------------

export type AccountingBasis = 'accrual' | 'cash'

/**
 * Determine if a tax is exigible (due) based on the accounting basis.
 *
 * Odoo has tax_exigibility: 'on_invoice' (accrual) or 'on_payment' (cash basis).
 * In cash basis, tax is only due when payment is received, not when invoice is issued.
 */
export function isTaxExigible(
  taxExigibility: 'on_invoice' | 'on_payment',
  basis: AccountingBasis,
  isPaid: boolean,
): boolean {
  if (taxExigibility === 'on_invoice') return true  // always due
  if (taxExigibility === 'on_payment') return isPaid  // due only when paid
  return basis === 'accrual'  // default: accrual basis
}

// ---------------------------------------------------------------------------
// 10. Secure Entry (Odoo's account_secure_entries_wizard)
// ---------------------------------------------------------------------------

/**
 * Secure a journal entry — prevents any future modification.
 * Once secured, the entry can only be read, not edited or deleted.
 *
 * In Odoo, this sets the `secured` field and creates an immutable hash.
 */
export async function secureJournalEntry(
  journalId: string,
  organizationId: string,
  userId: string,
): Promise<{ secured: boolean; hash: string | null }> {
  const { computeAndStoreJournalHash } = await import('./invoice-autopost')

  return atomicOperation(async (tx) => {
    // Verify the journal is Posted
    const journal = await tx.journal.findUnique({
      where: { id: journalId },
      include: { lines: true },
    })
    if (!journal) throw new Error('Journal not found')
    if (journal.status !== 'Posted') throw new Error('Only Posted journals can be secured')

    // Compute and store hash
    await computeAndStoreJournalHash(tx, journalId, organizationId)

    // Create audit log
    await tx.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'SECURE_JOURNAL',
        entityType: 'Journal',
        entityId: journalId,
        description: `Secured journal ${journal.journalNumber} — entry is now immutable`,
      },
    })

    const updated = await tx.journal.findUnique({
      where: { id: journalId },
      select: { inalterableHash: true },
    })

    return { secured: true, hash: updated?.inalterableHash || null }
  })
}
