import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, logAudit, getSystemContext } from "@/lib/api"
import { validateJournal, checkNotReconciled, autoFixRounding } from '@/lib/validation-engine'
import { atomicTransaction, recordWriteIntent, completeWriteIntent } from '@/lib/db-reliability'

// POST /api/journals/[id]/post — post an Approved journal to the GL
// Full Odoo-grade validation: balance, lock dates, fiscal period, hash chain
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSystemContext()
  const { id } = await params

  // 1. Load journal with lines
  const journal = await db.journal.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: { lines: { include: { account: true } }, fiscalPeriod: true },
  })
  if (!journal) return err('Journal not found', 404)
  if (journal.status !== 'Approved') {
    return err(`Cannot post — current status: ${journal.status}. Only Approved journals can be posted.`, 422)
  }

  // 2. Server-side validation (Odoo's _check_balanced + _check_complete)
  const validation = await validateJournal({
    organizationId: ctx.organizationId,
    journalDate: journal.journalDate,
    currency: journal.currency,
    exchangeRate: journal.exchangeRate,
    baseCurrency: 'USD', // would fetch from org
    source: journal.source || undefined,
    submit: true,
    lines: journal.lines.map(l => ({
      accountId: l.accountId,
      accountCode: l.account?.code,
      debit: l.debit,
      credit: l.credit,
      description: l.description || undefined,
    })),
  })

  if (!validation.valid) {
    return err(
      `Validation failed:\n${validation.errors.map(e => `  • ${e.message}`).join('\n')}`,
      422,
      { errors: validation.errors, warnings: validation.warnings },
      'VALIDATION_ERROR'
    )
  }

  // 3. Check no lines are reconciled (Odoo's _check_reconciliation)
  const reconCheck = await checkNotReconciled(id)
  if (!reconCheck.valid) {
    return err(reconCheck.errors[0].message, 422, undefined, 'RECONCILED')
  }

  // 4. Check fiscal period not closed
  if (journal.fiscalPeriod && journal.fiscalPeriod.status === 'Closed') {
    return err(`Cannot post into closed fiscal period: ${journal.fiscalPeriod.name}`, 422)
  }

  // 5. Server-side recompute totals (defense in depth — Odoo does this too)
  const totalDebit = journal.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = journal.lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDebit - totalCredit) > 1) {
    return err(`Cannot post — journal not balanced (debits ${totalDebit} vs credits ${totalCredit})`, 422)
  }

  // 6. Record write intent (for crash recovery)
  const intentId = recordWriteIntent('POST_JOURNAL', 'Journal', { journalId: id, journalNumber: journal.journalNumber }, id)

  // 7. Atomic post with hash computation (Odoo's _post + _hash_moves)
  const { computeAndStoreJournalHash } = await import('@/lib/invoice-autopost')

  try {
    await atomicTransaction(async (tx) => {
      // Update journal status
      await tx.journal.update({
        where: { id },
        data: {
          status: 'Posted',
          postedById: ctx.userId,
          postedAt: new Date(),
          postingDate: new Date(),
          totalDebit,
          totalCredit,
        },
      })

      // Create approval trail
      await tx.journalApproval.create({
        data: { journalId: id, action: 'Posted', byUserId: ctx.userId },
      })

      // Compute and store hash — makes the journal entry tamper-proof
      await computeAndStoreJournalHash(tx, id, ctx.organizationId)
    }, { intentId, timeout: 15000, retries: 3 })

    await logAudit({
      action: 'POST_JOURNAL',
      entityType: 'Journal',
      entityId: id,
      description: `Posted journal ${journal.journalNumber} (${journal.description || '—'}) to the general ledger. Hash chain updated.`,
    })

    return ok({
      success: true,
      posted: true,
      journalNumber: journal.journalNumber,
      hashComputed: true,
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
    })
  } catch (e) {
    return err(
      e instanceof Error ? `Failed to post journal: ${e.message}` : 'Failed to post journal',
      500,
      undefined,
      'INTERNAL_ERROR'
    )
  }
}
