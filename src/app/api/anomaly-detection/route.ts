import { db } from '@/lib/db'
import { ok, getSystemContext } from '@/lib/api'

// GET /api/anomaly-detection — flags unusual transactions
export async function GET() {
  const ctx = await getSystemContext()
  const anomalies: Array<{ type: string; description: string; severity: 'warning' | 'critical'; entityId?: string }> = []

  // 1. Duplicate invoice amounts (same customer, same amount, within 30 days)
  const invoices = await db.invoice.findMany({
    where: { organizationId: ctx.organizationId },
    include: { customer: true },
    orderBy: { invoiceDate: 'desc' },
  })
  for (let i = 0; i < invoices.length; i++) {
    for (let j = i + 1; j < invoices.length; j++) {
      if (invoices[i].customerId === invoices[j].customerId &&
          invoices[i].amount === invoices[j].amount &&
          Math.abs(invoices[i].invoiceDate.getTime() - invoices[j].invoiceDate.getTime()) < 30 * 86400000) {
        anomalies.push({
          type: 'DUPLICATE_INVOICE',
          description: `Possible duplicate: Invoice ${invoices[i].invoiceNumber} and ${invoices[j].invoiceNumber} have the same amount (${invoices[i].amount} cents) for customer ${invoices[i].customer?.name}`,
          severity: 'warning',
        })
      }
    }
  }

  // 2. Unusually large journal entries (> 10x average)
  const journals = await db.journal.findMany({
    where: { organizationId: ctx.organizationId, status: 'Posted' },
  })
  if (journals.length > 5) {
    const avgAmount = journals.reduce((s, j) => s + j.totalDebit, 0) / journals.length
    for (const j of journals) {
      if (j.totalDebit > avgAmount * 10 && avgAmount > 0) {
        anomalies.push({
          type: 'LARGE_ENTRY',
          description: `Journal ${j.journalNumber} is unusually large (${j.totalDebit} cents vs average ${Math.round(avgAmount)} cents)`,
          severity: 'warning',
          entityId: j.id,
        })
      }
    }
  }

  // 3. Overdue invoices > 90 days
  const today = new Date()
  for (const inv of invoices) {
    const daysOverdue = Math.floor((today.getTime() - inv.dueDate.getTime()) / 86400000)
    if (daysOverdue > 90 && inv.amountPaid < inv.amount) {
      anomalies.push({
        type: 'OVERDUE_90',
        description: `Invoice ${inv.invoiceNumber} (${inv.customer?.name}) is ${daysOverdue} days overdue`,
        severity: 'critical',
        entityId: inv.id,
      })
    }
  }

  // 4. Unbalanced trial balance
  const tbRes = await fetch('http://localhost:3000/api/reports/trial-balance')
  if (tbRes.ok) {
    const tb = await tbRes.json()
    if (tb.totals && Math.abs(tb.totals.debit - tb.totals.credit) > 1) {
      anomalies.push({
        type: 'TRIAL_BALANCE_MISMATCH',
        description: `Trial balance is out of balance by ${Math.abs(tb.totals.debit - tb.totals.credit)} cents`,
        severity: 'critical',
      })
    }
  }

  return ok({ anomalies, count: anomalies.length })
}
