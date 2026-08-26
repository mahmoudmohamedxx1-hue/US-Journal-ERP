import { db } from '@/lib/db'
import { ok, err, getSystemContext } from "@/lib/api"

// GET /api/dashboard — KPI tiles + recent activity + monthly trend
export async function GET() {
  const ctx = await getSystemContext()
  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } })

  const [
    postedJournals,
    allJournals,
    bankAccounts,
    vendors,
    customers,
    openInvoices,
    openBills,
  ] = await Promise.all([
    db.journal.findMany({
      where: { organizationId: ctx.organizationId, status: 'Posted' },
      include: { lines: { include: { account: true } } },
    }),
    db.journal.findMany({
      where: { organizationId: ctx.organizationId },
      include: { createdBy: true, lines: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    db.bankAccount.findMany({ where: { organizationId: ctx.organizationId } }),
    db.vendor.findMany({ where: { organizationId: ctx.organizationId, active: true } }),
    db.customer.findMany({ where: { organizationId: ctx.organizationId, active: true } }),
    db.invoice.findMany({
      where: { organizationId: ctx.organizationId, status: { in: ['Open', 'Partially Paid', 'Overdue'] } },
    }),
    db.bill.findMany({
      where: { organizationId: ctx.organizationId, status: { in: ['Open', 'Partially Paid', 'Overdue'] } },
    }),
  ])

  // Cash position (sum of all bank accounts)
  const cashBalance = bankAccounts.reduce((s, b) => s + b.balance, 0)

  // Compute YTD revenue & expenses using the shared finance module
  // so dashboard numbers match Trial Balance, Income Statement, Balance Sheet, and Cash Flow.
  const { computeAccountBalances, computeFinancialSummary } = await import('@/lib/finance')
  const balances = await computeAccountBalances({
    organizationId: ctx.organizationId,
    asOf: new Date('2026-12-31'),
    from: new Date('2026-01-01'),
  })
  const summary = computeFinancialSummary(balances)

  const ytdRevenue = summary.totalRevenue       // operating + other income
  const ytdExpenses = summary.costOfGoodsSold + summary.operatingExpenses + summary.otherExpenses
  const netIncome = summary.netIncome

  // Monthly P&L for chart (still computed from raw journals for per-month breakdown)
  const monthlyPnl: Array<{ month: string; revenue: number; expenses: number }> = []
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  for (let m = 0; m < 12; m++) {
    monthlyPnl.push({ month: months[m], revenue: 0, expenses: 0 })
  }
  for (const j of postedJournals) {
    const m = j.journalDate.getMonth()
    for (const l of j.lines) {
      const acct = l.account
      if (!acct) continue
      if (acct.accountType === 'Revenue') {
        monthlyPnl[m].revenue += l.credit - l.debit
      } else if (acct.accountType === 'Expense') {
        monthlyPnl[m].expenses += l.debit - l.credit
      }
    }
  }

  const accountsReceivable = customers.reduce((s, c) => s + c.balance, 0)
  const accountsPayable = vendors.reduce((s, v) => s + v.balance, 0)

  // Unposted count (Draft + Submitted + Under Review + Approved)
  const unpostedStatuses = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected']
  const unpostedByStatus: Record<string, number> = {}
  for (const s of unpostedStatuses) {
    unpostedByStatus[s] = await db.journal.count({
      where: { organizationId: ctx.organizationId, status: s },
    })
  }
  const unpostedCount = unpostedStatuses.reduce(
    (s, st) => s + (unpostedByStatus[st] || 0),
    0,
  )

  // Overdue invoices / bills
  const today = new Date('2026-08-24')
  const overdueInvoices = openInvoices.filter((i) => i.dueDate < today && i.amountPaid < i.amount)
  const overdueBills = openBills.filter((b) => b.dueDate < today && b.amountPaid < b.amount)

  // Open invoices total
  const openAR = openInvoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0)
  const openAP = openBills.reduce((s, b) => s + (b.amount - b.amountPaid), 0)

  // Fiscal period status
  const periods = await db.fiscalPeriod.findMany({
    where: { fiscalYear: { organizationId: ctx.organizationId } },
    orderBy: { periodNumber: 'asc' },
    include: { fiscalYear: true },
  })

  return ok({
    organization: org,
    kpis: {
      cashBalance,
      ytdRevenue,
      ytdExpenses,
      netIncome,
      accountsReceivable,
      accountsPayable,
      openAR,
      openAP,
      unpostedCount,
      unpostedByStatus,
      overdueInvoicesCount: overdueInvoices.length,
      overdueBillsCount: overdueBills.length,
    },
    monthlyPnl: monthlyPnl.slice(0, 8),
    recentJournals: allJournals.map((j) => ({
      id: j.id,
      journalNumber: j.journalNumber,
      journalDate: j.journalDate,
      description: j.description,
      status: j.status,
      totalDebit: j.totalDebit,
      createdBy: j.createdBy.name,
    })),
    bankAccounts: bankAccounts.map((b) => ({
      id: b.id,
      name: b.accountName,
      bankName: b.bankName,
      accountNumber: b.accountNumber,
      type: b.accountType,
      balance: b.balance,
    })),
    fiscalPeriods: periods.map((p) => ({
      id: p.id,
      name: p.name,
      periodNumber: p.periodNumber,
      status: p.status,
      fiscalYear: p.fiscalYear.name,
    })),
  })
}
