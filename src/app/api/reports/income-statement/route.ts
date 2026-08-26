import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from "@/lib/api"
import { computeAccountBalances, computeFinancialSummary, type AccountBalance } from '@/lib/finance'

// GET /api/reports/income-statement
// Returns revenue, COGS, gross profit, operating expenses, operating income, other income, net income.
// Uses the shared finance module so revenue matches Dashboard, Trial Balance, Balance Sheet, Cash Flow.
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
    ? new Date(url.searchParams.get('from')!)
    : new Date('2026-01-01')
  const to = url.searchParams.get('to')
    ? new Date(url.searchParams.get('to')!)
    : new Date('2026-12-31')

  const balances = await computeAccountBalances({
    organizationId: ctx.organizationId,
    asOf: to,
    from,
  })

  const summary = computeFinancialSummary(balances)

  // Build detailed line items per category
  type Line = { code: string; name: string; amount: number }

  const operatingRevenueAccounts = balances.filter(a =>
    a.accountType === 'Revenue' && (a.subType || '').toLowerCase() !== 'other income'
  )
  const revenue: Line[] = operatingRevenueAccounts
    .map(a => ({ code: a.code, name: a.name, amount: -a.netBalance }))
    .filter(r => Math.abs(r.amount) >= 0.005)

  const cogs: Line[] = balances
    .filter(a => a.accountType === 'Expense' && (a.subType || '').toLowerCase() === 'cogs')
    .map(a => ({ code: a.code, name: a.name, amount: a.netBalance }))
    .filter(r => Math.abs(r.amount) >= 0.005)

  const operatingExpenses: Line[] = balances
    .filter(a => a.accountType === 'Expense' && (a.subType || '').toLowerCase() === 'operating expense')
    .map(a => ({ code: a.code, name: a.name, amount: a.netBalance }))
    .filter(r => Math.abs(r.amount) >= 0.005)

  const otherIncomeAccounts: Line[] = balances
    .filter(a => a.accountType === 'Revenue' && (a.subType || '').toLowerCase() === 'other income')
    .map(a => ({ code: a.code, name: a.name, amount: -a.netBalance }))
    .filter(r => Math.abs(r.amount) >= 0.005)

  const otherExpenses: Line[] = balances
    .filter(a => a.accountType === 'Expense' && ['other expense', 'tax'].includes((a.subType || '').toLowerCase()))
    .map(a => ({ code: a.code, name: a.name, amount: a.netBalance }))
    .filter(r => Math.abs(r.amount) >= 0.005)

  return ok({
    from: from.toISOString(),
    to: to.toISOString(),
    revenue,
    totalRevenue: summary.operatingRevenue,
    cogs,
    totalCogs: summary.costOfGoodsSold,
    grossProfit: summary.grossProfit,
    operatingExpenses,
    totalOperating: summary.operatingExpenses,
    operatingIncome: summary.operatingIncome,
    otherIncome: otherIncomeAccounts,
    totalOtherIncome: summary.otherIncome,
    otherExpenses,
    totalOtherExpenses: summary.otherExpenses,
    netIncome: summary.netIncome,
    // Also expose totalRevenue including other income for consistency with Dashboard
    totalRevenueIncludingOther: summary.totalRevenue,
  })
}
