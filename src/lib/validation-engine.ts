/**
 * US Journal ERP — Server-Side Validation Engine
 *
 * Inspired by Odoo's account_move.py validation methods:
 *   - _check_balanced: debits must equal credits
 *   - _check_fiscal_lock_dates: no posting before lock dates
 *   - _check_reconciliation: can't modify reconciled lines
 *   - _check_tax_lock_date: can't modify tax lines after tax lock
 *   - _check_journal_move_type: can't create sale doc in purchase journal
 *   - _validate_taxes_country: tax country consistency
 *   - _check_complete: required fields present
 *   - _get_accounting_date: compute proper accounting date considering lock dates
 *
 * ALL validation happens server-side — the client is never trusted.
 */

import { db } from '@/lib/db'

export type ValidationError = {
  field: string
  message: string
  code: string
  severity: 'error' | 'warning'
}

export type ValidationResult = {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

// ---------------------------------------------------------------------------
// 1. Balance Check (Odoo's _check_balanced)
// ---------------------------------------------------------------------------

export function checkBalanced(lines: Array<{ debit: number; credit: number }>): ValidationResult {
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0)
  const diff = Math.abs(totalDebit - totalCredit)

  if (diff > 1) { // > 1 cent tolerance
    return {
      valid: false,
      errors: [{
        field: 'balance',
        message: `Journal is not balanced: debits ${totalDebit} ≠ credits ${totalCredit} (difference: ${diff} cents)`,
        code: 'NOT_BALANCED',
        severity: 'error',
      }],
      warnings: [],
    }
  }

  if (diff > 0) {
    return {
      valid: true,
      errors: [],
      warnings: [{
        field: 'balance',
        message: `Small rounding difference of ${diff} cent(s) detected — will be auto-corrected`,
        code: 'ROUNDING_DIFF',
        severity: 'warning',
      }],
    }
  }

  return { valid: true, errors: [], warnings: [] }
}

// ---------------------------------------------------------------------------
// 2. Line Validation (Odoo's _check_complete + _check_accountable)
// ---------------------------------------------------------------------------

export function validateLines(lines: Array<{
  accountId?: string
  accountCode?: string
  debit: number
  credit: number
  description?: string
}>): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  if (lines.length < 2) {
    errors.push({
      field: 'lines',
      message: 'A journal must contain at least two lines',
      code: 'MIN_LINES',
      severity: 'error',
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Each line must have an account
    if (!line.accountId && !line.accountCode) {
      errors.push({
        field: `line[${i}].accountId`,
        message: `Line ${i + 1} is missing an account`,
        code: 'MISSING_ACCOUNT',
        severity: 'error',
      })
    }

    // Debit and credit cannot both be positive
    if (line.debit > 0 && line.credit > 0) {
      errors.push({
        field: `line[${i}].debit`,
        message: `Line ${i + 1}: debit and credit cannot both be entered`,
        code: 'BOTH_DEBIT_CREDIT',
        severity: 'error',
      })
    }

    // Amounts must be non-negative
    if (line.debit < 0 || line.credit < 0) {
      errors.push({
        field: `line[${i}].debit`,
        message: `Line ${i + 1}: amounts must be positive`,
        code: 'NEGATIVE_AMOUNT',
        severity: 'error',
      })
    }

    // Warn on very large amounts (potential data entry error)
    const maxAmount = 1000000000 // $10 million in cents
    if (line.debit > maxAmount || line.credit > maxAmount) {
      warnings.push({
        field: `line[${i}].debit`,
        message: `Line ${i + 1}: unusually large amount — please verify`,
        code: 'LARGE_AMOUNT',
        severity: 'warning',
      })
    }

    // Warn on zero-amount lines with an account
    if (line.accountId && line.debit === 0 && line.credit === 0) {
      warnings.push({
        field: `line[${i}].debit`,
        message: `Line ${i + 1} has an account but zero amount`,
        code: 'ZERO_AMOUNT',
        severity: 'warning',
      })
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// 3. Date Validation (Odoo's _get_accounting_date)
// ---------------------------------------------------------------------------

export function validateDate(
  journalDate: Date,
  options: { allowFuture?: boolean; maxFutureDays?: number } = {},
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  const now = new Date()

  // Check for invalid date
  if (isNaN(journalDate.getTime())) {
    errors.push({
      field: 'journalDate',
      message: 'Invalid date',
      code: 'INVALID_DATE',
      severity: 'error',
    })
    return { valid: false, errors, warnings }
  }

  // Future date check
  if (journalDate > now && !options.allowFuture) {
    const maxFutureDays = options.maxFutureDays || 365
    const futureMs = journalDate.getTime() - now.getTime()
    const futureDays = Math.floor(futureMs / 86400000)

    if (futureDays > maxFutureDays) {
      errors.push({
        field: 'journalDate',
        message: `Date is ${futureDays} days in the future (max allowed: ${maxFutureDays} days)`,
        code: 'FUTURE_DATE_TOO_FAR',
        severity: 'error',
      })
    } else {
      warnings.push({
        field: 'journalDate',
        message: `Date is ${futureDays} days in the future`,
        code: 'FUTURE_DATE',
        severity: 'warning',
      })
    }
  }

  // Very old date check
  const minDate = new Date('2000-01-01')
  if (journalDate < minDate) {
    errors.push({
      field: 'journalDate',
      message: `Date is before year 2000 — please verify`,
      code: 'DATE_TOO_OLD',
      severity: 'error',
    })
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// 4. Posted Entry Modification Check (Odoo's write() validation)
// ---------------------------------------------------------------------------

export async function checkPostedEntryNotModified(
  journalId: string,
  changedFields: string[],
): Promise<ValidationResult> {
  const journal = await db.journal.findUnique({
    where: { id: journalId },
    select: { status: true, inalterableHash: true },
  })

  if (!journal) {
    return {
      valid: false,
      errors: [{ field: 'id', message: 'Journal not found', code: 'NOT_FOUND', severity: 'error' }],
      warnings: [],
    }
  }

  // If posted, only certain fields can be changed
  if (journal.status === 'Posted') {
    // Fields that CANNOT be changed on a posted journal
    const protectedFields = [
      'journalDate', 'lines', 'totalDebit', 'totalCredit', 'currency',
      'exchangeRate', 'source', 'reference', 'description',
      'accountId', 'debit', 'credit', 'lineNumber',
    ]

    // If the journal has a hash, NOTHING can be changed
    if (journal.inalterableHash) {
      const violations = changedFields.filter(f => protectedFields.includes(f) || f === 'inalterableHash')
      if (violations.length > 0) {
        return {
          valid: false,
          errors: violations.map(f => ({
            field: f,
            message: `Cannot modify field '${f}' on a secured (hashed) posted journal entry`,
            code: 'HASH_PROTECTED',
            severity: 'error',
          })),
          warnings: [],
        }
      }
    }

    // Without hash, only warn about modifying posted entries
    const violations = changedFields.filter(f => protectedFields.includes(f))
    if (violations.length > 0) {
      return {
        valid: false,
        errors: violations.map(f => ({
          field: f,
          message: `Cannot modify field '${f}' on a posted journal entry. Reset to draft first.`,
          code: 'POSTED_READONLY',
          severity: 'error',
        })),
        warnings: [],
      }
    }
  }

  return { valid: true, errors: [], warnings: [] }
}

// ---------------------------------------------------------------------------
// 5. Reconciliation Check (Odoo's _check_reconciliation)
// ---------------------------------------------------------------------------

export async function checkNotReconciled(journalId: string): Promise<ValidationResult> {
  const lines = await db.journalLine.findMany({
    where: { journalId },
    select: { id: true },
  })

  for (const line of lines) {
    const allocations = await db.allocation.findMany({
      where: {
        OR: [
          { paymentId: line.id },
          { invoiceId: line.id },
        ],
      },
    })

    if (allocations.length > 0) {
      return {
        valid: false,
        errors: [{
          field: 'lines',
          message: `Cannot modify journal — line ${line.id} is reconciled. Unreconcile first.`,
          code: 'RECONCILED_LINE',
          severity: 'error',
        }],
        warnings: [],
      }
    }
  }

  return { valid: true, errors: [], warnings: [] }
}

// ---------------------------------------------------------------------------
// 6. Fiscal Period Check
// ---------------------------------------------------------------------------

export async function checkFiscalPeriod(
  organizationId: string,
  journalDate: Date,
): Promise<ValidationResult> {
  const fy = await db.fiscalYear.findFirst({
    where: {
      organizationId,
      startDate: { lte: journalDate },
      endDate: { gte: journalDate },
    },
  })

  if (!fy) {
    return {
      valid: true, // No fiscal year is not an error — just no period control
      errors: [],
      warnings: [{
        field: 'fiscalPeriod',
        message: 'No fiscal year covers this date — entry will not be tied to a period',
        code: 'NO_FISCAL_YEAR',
        severity: 'warning',
      }],
    }
  }

  const period = await db.fiscalPeriod.findFirst({
    where: {
      fiscalYearId: fy.id,
      startDate: { lte: journalDate },
      endDate: { gte: journalDate },
    },
  })

  if (!period) {
    return {
      valid: true,
      errors: [],
      warnings: [{
        field: 'fiscalPeriod',
        message: `Date falls outside defined periods in ${fy.name}`,
        code: 'NO_PERIOD',
        severity: 'warning',
      }],
    }
  }

  if (period.status === 'Closed') {
    return {
      valid: false,
      errors: [{
        field: 'fiscalPeriod',
        message: `Cannot post into closed fiscal period: ${period.name}`,
        code: 'CLOSED_PERIOD',
        severity: 'error',
      }],
      warnings: [],
    }
  }

  return { valid: true, errors: [], warnings: [] }
}

// ---------------------------------------------------------------------------
// 7. Currency Validation (Odoo's _check_currency)
// ---------------------------------------------------------------------------

export function validateCurrency(
  currency: string,
  exchangeRate: number,
  baseCurrency: string,
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  if (!currency || currency.length !== 3) {
    errors.push({
      field: 'currency',
      message: 'Currency must be a 3-letter ISO code (e.g., USD, EUR, EGP)',
      code: 'INVALID_CURRENCY',
      severity: 'error',
    })
  }

  if (currency === baseCurrency) {
    // Same currency — exchange rate must be 1.0 (100 basis points)
    if (exchangeRate !== 100 && exchangeRate !== 1) {
      warnings.push({
        field: 'exchangeRate',
        message: `Exchange rate should be 1.0 for same-currency entries (got ${exchangeRate / 100})`,
        code: 'RATE_SHOULD_BE_1',
        severity: 'warning',
      })
    }
  } else {
    // Foreign currency — must have a valid exchange rate
    if (!exchangeRate || exchangeRate <= 0) {
      errors.push({
        field: 'exchangeRate',
        message: `Exchange rate is required for ${currency} entries (base currency: ${baseCurrency})`,
        code: 'MISSING_EXCHANGE_RATE',
        severity: 'error',
      })
    }

    // Warn on extreme rates
    if (exchangeRate > 1000000) { // > 10000x
      warnings.push({
        field: 'exchangeRate',
        message: `Exchange rate seems unusually high: ${exchangeRate / 100}`,
        code: 'EXTREME_RATE',
        severity: 'warning',
      })
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// 8. Comprehensive Journal Validation
// ---------------------------------------------------------------------------

export interface JournalValidationInput {
  organizationId: string
  journalDate: string | Date
  currency: string
  exchangeRate: number
  baseCurrency: string
  source?: string
  submit: boolean
  lines: Array<{
    accountId?: string
    accountCode?: string
    debit: number
    credit: number
    description?: string
  }>
}

export async function validateJournal(input: JournalValidationInput): Promise<ValidationResult> {
  const allErrors: ValidationError[] = []
  const allWarnings: ValidationError[] = []

  // 1. Validate lines
  const lineResult = validateLines(input.lines)
  allErrors.push(...lineResult.errors)
  allWarnings.push(...lineResult.warnings)

  // 2. Check balance (only if submitting — drafts can be unbalanced)
  if (input.submit) {
    const balanceResult = checkBalanced(input.lines)
    allErrors.push(...balanceResult.errors)
    allWarnings.push(...balanceResult.warnings)
  }

  // 3. Validate date
  const dateResult = validateDate(new Date(input.journalDate))
  allErrors.push(...dateResult.errors)
  allWarnings.push(...dateResult.warnings)

  // 4. Validate currency
  const currencyResult = validateCurrency(input.currency, input.exchangeRate, input.baseCurrency)
  allErrors.push(...currencyResult.errors)
  allWarnings.push(...currencyResult.warnings)

  // 5. Check fiscal period
  const periodResult = await checkFiscalPeriod(input.organizationId, new Date(input.journalDate))
  allErrors.push(...periodResult.errors)
  allWarnings.push(...periodResult.warnings)

  // 6. Check lock dates (5 levels)
  const { getViolatedLockDates } = await import('./reliability')
  const lockViolations = await getViolatedLockDates(input.organizationId, new Date(input.journalDate), {
    hasTax: input.lines.some(l => (l as { taxCodeId?: string }).taxCodeId),
    journalType: input.source || 'general',
  })

  for (const violation of lockViolations) {
    if (violation.severity === 'hard') {
      allErrors.push({
        field: violation.field,
        message: violation.message,
        code: 'LOCK_DATE_HARD',
        severity: 'error',
      })
    } else if (input.submit) {
      // Soft lock dates only block submissions, not drafts
      allErrors.push({
        field: violation.field,
        message: violation.message,
        code: 'LOCK_DATE_SOFT',
        severity: 'error',
      })
    } else {
      allWarnings.push({
        field: violation.field,
        message: violation.message + ' (draft allowed)',
        code: 'LOCK_DATE_SOFT',
        severity: 'warning',
      })
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  }
}

// ---------------------------------------------------------------------------
// 9. Auto-fix rounding (Odoo's _check_total_amount)
// ---------------------------------------------------------------------------

/**
 * Auto-fix small rounding differences by adjusting the last line.
 * Odoo does this in _check_total_amount.
 */
export function autoFixRounding(lines: Array<{ debit: number; credit: number }>): Array<{ debit: number; credit: number }> {
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  const diff = totalDebit - totalCredit

  if (Math.abs(diff) <= 1 && lines.length > 0) {
    // Adjust the last line to balance
    const fixedLines = [...lines]
    if (diff > 0) {
      // Debit is higher — increase credit on last line
      fixedLines[fixedLines.length - 1] = {
        ...fixedLines[fixedLines.length - 1],
        credit: fixedLines[fixedLines.length - 1].credit + diff,
      }
    } else if (diff < 0) {
      // Credit is higher — increase debit on last line
      fixedLines[fixedLines.length - 1] = {
        ...fixedLines[fixedLines.length - 1],
        debit: fixedLines[fixedLines.length - 1].debit + Math.abs(diff),
      }
    }
    return fixedLines
  }

  return lines
}
