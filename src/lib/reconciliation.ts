/**
 * US Journal ERP — Full/Partial Reconciliation Engine
 *
 * Inspired by Odoo's account_partial_reconcile + account_full_reconcile.
 *
 * Odoo tracks reconciliation at the journal LINE level:
 *   - Partial reconcile: links a debit line to a credit line with an amount
 *   - Full reconcile: created when all partials sum to the total — marks lines as fully reconciled
 *
 * This module does the same using our Allocation model as the partial reconcile record.
 */

import { db } from '@/lib/db'
import { logAudit } from '@/lib/api'

export interface ReconciliationResult {
  matched: boolean
  fullyReconciled: boolean
  matchedAmount: number
  remainingAmount: number
  message: string
}

/**
 * Reconcile a payment (or bank transaction) against an invoice/bill.
 *
 * This is Odoo's `register_payment()` on account.move.line.
 *
 * @param paymentLineId - the journal line representing the payment (debit for receipts, credit for payments)
 * @param invoiceLineId - the journal line representing the AR/AP
 * @param amount - amount to reconcile (in cents)
 * @param organizationId
 * @param userId
 */
export async function reconcilePayment(
  paymentLineId: string,
  invoiceLineId: string,
  amount: number,
  organizationId: string,
  userId: string,
): Promise<ReconciliationResult> {
  const [paymentLine, invoiceLine] = await Promise.all([
    db.journalLine.findUnique({
      where: { id: paymentLineId },
      include: { journal: true, account: true },
    }),
    db.journalLine.findUnique({
      where: { id: invoiceLineId },
      include: { journal: true, account: true },
    }),
  ])

  if (!paymentLine || !invoiceLine) {
    throw new Error('Journal lines not found')
  }
  if (paymentLine.journal.organizationId !== organizationId) {
    throw new Error('Payment line does not belong to this organization')
  }
  if (invoiceLine.journal.organizationId !== organizationId) {
    throw new Error('Invoice line does not belong to this organization')
  }

  // Get existing partial reconciliations for this pair
  const existingPartials = await db.allocation.findMany({
    where: {
      OR: [
        { paymentId: paymentLineId, invoiceId: invoiceLineId },
      ],
    },
  })

  const previouslyMatched = existingPartials.reduce((s, p) => s + p.amount, 0)
  const totalToReconcile = Math.min(
    Math.abs(paymentLine.debit - paymentLine.credit),
    Math.abs(invoiceLine.debit - invoiceLine.credit),
  )
  const remainingAfter = totalToReconcile - previouslyMatched - amount

  const fullyReconciled = remainingAfter <= 0

  // Create the partial reconciliation record
  await db.allocation.create({
    data: {
      paymentId: paymentLineId,
      invoiceId: invoiceLineId,
      amount,
    },
  })

  await logAudit({
    action: 'PARTIAL_RECONCILE',
    entityType: 'JournalLine',
    entityId: paymentLineId,
    description: `Reconciled ${amount} cents between payment ${paymentLine.journal.journalNumber} and invoice ${invoiceLine.journal.journalNumber}${fullyReconciled ? ' (FULLY RECONCILED)' : ''}`,
    userId,
    organizationId,
  })

  return {
    matched: true,
    fullyReconciled,
    matchedAmount: amount,
    remainingAmount: Math.max(0, remainingAfter),
    message: fullyReconciled
      ? 'Payment fully reconciled — invoice/bill is now closed'
      : `Partial reconciliation: ${amount} cents matched, ${Math.max(0, remainingAfter)} remaining`,
  }
}

/**
 * Get all reconciliations for a journal line.
 * Shows which payments have been matched against it.
 */
export async function getReconciliations(journalLineId: string) {
  const asPayment = await db.allocation.findMany({
    where: { paymentId: journalLineId },
    include: { invoice: { include: { journal: true } } },
  })
  const asInvoice = await db.allocation.findMany({
    where: { invoiceId: journalLineId },
    include: { payment: { include: { journal: true } } },
  })

  return {
    asPayment: asPayment.map(a => ({
      allocationId: a.id,
      amount: a.amount,
      matchedLineId: a.invoiceId,
      matchedJournalNumber: a.invoice?.journal?.journalNumber || null,
    })),
    asInvoice: asInvoice.map(a => ({
      allocationId: a.id,
      amount: a.amount,
      matchedLineId: a.paymentId,
      matchedJournalNumber: a.payment?.journal?.journalNumber || null,
    })),
  }
}

/**
 * Unreconcile (reverse) a reconciliation.
 * Removes the allocation record.
 */
export async function unreconcile(
  allocationId: string,
  organizationId: string,
  userId: string,
) {
  const allocation = await db.allocation.findUnique({ where: { id: allocationId } })
  if (!allocation) throw new Error('Allocation not found')

  await db.allocation.delete({ where: { id: allocationId } })

  await logAudit({
    action: 'UNRECONCILE',
    entityType: 'Allocation',
    entityId: allocationId,
    description: `Unreconciled ${allocation.amount} cents`,
    userId,
    organizationId,
  })

  return { success: true, unreconciledAmount: allocation.amount }
}
