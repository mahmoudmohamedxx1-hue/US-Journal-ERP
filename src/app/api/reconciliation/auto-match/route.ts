import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext, logAudit } from '@/lib/api'

/**
 * POST /api/reconciliation/auto-match
 *
 * Inspired by Odoo's account_reconcile_model.
 *
 * Auto-matches bank transactions to open invoices/bills based on:
 *   1. Amount match (exact or within tolerance)
 *   2. Reference match (payment reference matches invoice/bill number)
 *   3. Partner match (bank transaction partner matches invoice/bill customer/vendor)
 *
 * Body: { reconciliationId: string }
 * Returns: { matches: [{ bankTransactionId, invoiceId/billId, amount, confidence }] }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { reconciliationId } = body
    if (!reconciliationId) return err('reconciliationId is required', 422, undefined, 'VALIDATION_ERROR')

    const reconciliation = await db.reconciliation.findFirst({
      where: { id: reconciliationId, organizationId: ctx.organizationId },
      include: { bankAccount: true },
    })
    if (!reconciliation) return err('Reconciliation session not found', 404, undefined, 'NOT_FOUND')

    // Get unreconciled bank transactions for this account
    const bankTxns = await db.bankTransaction.findMany({
      where: { bankAccountId: reconciliation.bankAccountId, reconciled: false },
      orderBy: { date: 'asc' },
    })

    // Get open invoices and bills
    const [openInvoices, openBills] = await Promise.all([
      db.invoice.findMany({
        where: { organizationId: ctx.organizationId, status: { in: ['Open', 'Partially Paid', 'Overdue'] } },
        include: { customer: true },
      }),
      db.bill.findMany({
        where: { organizationId: ctx.organizationId, status: { in: ['Open', 'Partially Paid', 'Overdue'] } },
        include: { vendor: true },
      }),
    ])

    const matches: Array<{
      bankTransactionId: string
      type: 'invoice' | 'bill'
      documentId: string
      documentNumber: string
      amount: number
      confidence: 'high' | 'medium' | 'low'
      matchReason: string
    }> = []

    for (const txn of bankTxns) {
      const txnAmount = Math.abs(txn.amount)
      const txnRef = (txn.reference || '').toLowerCase()
      const txnDesc = (txn.description || '').toLowerCase()

      let bestMatch: { type: 'invoice' | 'bill'; doc: any; confidence: 'high' | 'medium' | 'low'; reason: string } | null = null

      // Try exact amount match with invoices
      for (const inv of openInvoices) {
        const outstanding = inv.amount - inv.amountPaid
        if (outstanding <= 0) continue

        // Exact amount match
        if (txnAmount === outstanding) {
          // Check reference match
          const invRef = (inv.invoiceNumber || '').toLowerCase()
          if (txnRef && invRef && (txnRef.includes(invRef) || invRef.includes(txnRef))) {
            bestMatch = { type: 'invoice', doc: inv, confidence: 'high', reason: 'Exact amount + reference match' }
            break
          }
          // Check customer name in description
          const custName = (inv.customer?.name || '').toLowerCase()
          if (custName && txnDesc.includes(custName)) {
            bestMatch = { type: 'invoice', doc: inv, confidence: 'high', reason: 'Exact amount + customer name in description' }
            break
          }
          bestMatch = { type: 'invoice', doc: inv, confidence: 'medium', reason: 'Exact amount match' }
          break
        }

        // Partial amount match (within 1% tolerance)
        const tolerance = Math.max(100, outstanding * 0.01) // 1% or at least $1
        if (Math.abs(txnAmount - outstanding) <= tolerance) {
          bestMatch = { type: 'invoice', doc: inv, confidence: 'low', reason: 'Amount match within 1% tolerance' }
        }
      }

      // Try bills if no invoice match
      if (!bestMatch) {
        for (const bill of openBills) {
          const outstanding = bill.amount - bill.amountPaid
          if (outstanding <= 0) continue

          if (txnAmount === outstanding) {
            const billRef = (bill.billNumber || '').toLowerCase()
            if (txnRef && billRef && (txnRef.includes(billRef) || billRef.includes(txnRef))) {
              bestMatch = { type: 'bill', doc: bill, confidence: 'high', reason: 'Exact amount + reference match' }
              break
            }
            const vendorName = (bill.vendor?.name || '').toLowerCase()
            if (vendorName && txnDesc.includes(vendorName)) {
              bestMatch = { type: 'bill', doc: bill, confidence: 'high', reason: 'Exact amount + vendor name in description' }
              break
            }
            bestMatch = { type: 'bill', doc: bill, confidence: 'medium', reason: 'Exact amount match' }
            break
          }
        }
      }

      if (bestMatch) {
        matches.push({
          bankTransactionId: txn.id,
          type: bestMatch.type,
          documentId: bestMatch.doc.id,
          documentNumber: bestMatch.type === 'invoice' ? bestMatch.doc.invoiceNumber : bestMatch.doc.billNumber,
          amount: txnAmount,
          confidence: bestMatch.confidence,
          matchReason: bestMatch.reason,
        })
      }
    }

    return ok({
      matches,
      totalBankTransactions: bankTxns.length,
      matched: matches.length,
      unmatched: bankTxns.length - matches.length,
    })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}

/**
 * POST /api/reconciliation/auto-match with action='apply'
 * Applies the suggested matches: marks bank transactions as reconciled and
 * creates allocation records.
 */
export async function PUT(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { reconciliationId, matches } = body
    if (!reconciliationId || !matches || !Array.isArray(matches)) {
      return err('reconciliationId and matches array are required', 422, undefined, 'VALIDATION_ERROR')
    }

    let applied = 0
    for (const match of matches) {
      const { bankTransactionId, type, documentId, amount } = match

      await db.$transaction(async (tx) => {
        // Mark bank transaction as reconciled
        await tx.bankTransaction.update({
          where: { id: bankTransactionId },
          data: { reconciled: true, reconciledAt: new Date() },
        })

        // Update invoice/bill
        if (type === 'invoice') {
          const inv = await tx.invoice.findUnique({ where: { id: documentId } })
          if (inv) {
            const newPaid = inv.amountPaid + amount
            await tx.invoice.update({
              where: { id: documentId },
              data: { amountPaid: newPaid, status: newPaid >= inv.amount ? 'Paid' : 'Partially Paid' },
            })
          }
        } else {
          const bill = await tx.bill.findUnique({ where: { id: documentId } })
          if (bill) {
            const newPaid = bill.amountPaid + amount
            await tx.bill.update({
              where: { id: documentId },
              data: { amountPaid: newPaid, status: newPaid >= bill.amount ? 'Paid' : 'Partially Paid' },
            })
          }
        }
      })
      applied++
    }

    await logAudit({
      action: 'AUTO_RECONCILE',
      entityType: 'Reconciliation',
      entityId: reconciliationId,
      description: `Auto-reconciled ${applied} bank transactions`,
    })

    return ok({ applied, total: matches.length })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
