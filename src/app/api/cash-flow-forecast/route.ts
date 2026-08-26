import { db } from '@/lib/db'
import { ok, getSystemContext } from '@/lib/api'

// GET /api/cash-flow-forecast — project future cash position
// Based on: current bank balance + expected AR receipts (open invoices by due date)
//          - expected AP payments (open bills by due date)
//          + recurring journal income - recurring journal expenses
export async function GET() {
  const ctx = await getSystemContext()
  const today = new Date()

  // Current cash position
  const bankAccounts = await db.bankAccount.findMany({ where: { organizationId: ctx.organizationId } })
  const currentCash = bankAccounts.reduce((s, b) => s + b.balance, 0)

  // Open invoices (AR — money coming in)
  const openInvoices = await db.invoice.findMany({
    where: { organizationId: ctx.organizationId, status: { in: ['Open', 'Partially Paid', 'Overdue'] } },
    include: { customer: true },
    orderBy: { dueDate: 'asc' },
  })

  // Open bills (AP — money going out)
  const openBills = await db.bill.findMany({
    where: { organizationId: ctx.organizationId, status: { in: ['Open', 'Partially Paid', 'Overdue'] } },
    include: { vendor: true },
    orderBy: { dueDate: 'asc' },
  })

  // Recurring journals
  const recurring = await db.recurringJournal.findMany({
    where: { organizationId: ctx.organizationId, status: 'Active' },
  })

  // Build 6-month forecast
  const months: Array<{
    month: string
    inflow: number
    outflow: number
    net: number
    projectedBalance: number
  }> = []

  let runningBalance = currentCash

  for (let i = 0; i < 6; i++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + i + 1, 0)
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    // Expected inflow: invoices due this month
    let inflow = 0
    for (const inv of openInvoices) {
      if (inv.dueDate >= monthDate && inv.dueDate <= monthEnd) {
        inflow += inv.amount - inv.amountPaid
      }
    }

    // Expected outflow: bills due this month
    let outflow = 0
    for (const bill of openBills) {
      if (bill.dueDate >= monthDate && bill.dueDate <= monthEnd) {
        outflow += bill.amount - bill.amountPaid
      }
    }

    // Recurring journal impact (parse template for amounts)
    for (const rj of recurring) {
      try {
        const template = JSON.parse(rj.template)
        if (template.lines) {
          for (const line of template.lines) {
            if (line.debit > 0) outflow += line.debit
            if (line.credit > 0) inflow += line.credit
          }
        }
      } catch { /* ignore parse errors */ }
    }

    const net = inflow - outflow
    runningBalance += net

    months.push({
      month: monthLabel,
      inflow,
      outflow,
      net,
      projectedBalance: runningBalance,
    })
  }

  return ok({
    currentCash,
    forecast: months,
    openAR: openInvoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0),
    openAP: openBills.reduce((s, b) => s + (b.amount - b.amountPaid), 0),
    recurringCount: recurring.length,
  })
}
