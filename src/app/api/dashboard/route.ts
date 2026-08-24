import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/dashboard — KPI tiles + recent activity + monthly trend
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const org = await db.organization.findUniqueOrThrow({ where: { id: DEMO_ORG_ID } })

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
      where: { organizationId: DEMO_ORG_ID, status: 'Posted' },
      include: { lines: { include: { account: true } } },
    }),
    db.journal.findMany({
      where: { organizationId: DEMO_ORG_ID },
      include: { createdBy: true, lines: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    db.bankAccount.findMany({ where: { organizationId: DEMO_ORG_ID } }),
    db.vendor.findMany({ where: { organizationId: DEMO_ORG_ID, active: true } }),
    db.customer.findMany({ where: { organizationId: DEMO_ORG_ID, active: true } }),
    db.invoice.findMany({
      where: { organizationId: DEMO_ORG_ID, status: { in: ['Open', 'Partially Paid', 'Overdue'] } },
    }),
    db.bill.findMany({
      where: { organizationId: DEMO_ORG_ID, status: { in: ['Open', 'Partially Paid', 'Overdue'] } },
    }),
  ])

  // Cash position (sum of all bank accounts)
  const cashBalance = bankAccounts.reduce((s, b) => s + b.balance, 0)

  // Compute YTD revenue & expenses from posted journal lines
  let ytdRevenue = 0
  let ytdExpenses = 0
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
      const amount = l.debit - l.credit // signed: positive = debit-heavy
      if (acct.accountType === 'Revenue') {
        // Revenue has normal credit balance — credit increases revenue
        ytdRevenue += l.credit - l.debit
        monthlyPnl[m].revenue += l.credit - l.debit
      } else if (acct.accountType === 'Expense') {
        // Expense has normal debit balance
        ytdExpenses += l.debit - l.credit
        monthlyPnl[m].expenses += l.debit - l.credit
      }
    }
  }

  const netIncome = ytdRevenue - ytdExpenses

  const accountsReceivable = customers.reduce((s, c) => s + c.balance, 0)
  const accountsPayable = vendors.reduce((s, v) => s + v.balance, 0)

  // Unposted count (Draft + Submitted + Under Review + Approved)
  const unpostedStatuses = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected']
  const unpostedByStatus: Record<string, number> = {}
  for (const s of unpostedStatuses) {
    unpostedByStatus[s] = await db.journal.count({
      where: { organizationId: DEMO_ORG_ID, status: s },
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
    where: { fiscalYear: { organizationId: DEMO_ORG_ID } },
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
