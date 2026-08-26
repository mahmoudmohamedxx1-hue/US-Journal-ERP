import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from "@/lib/api"
import { computeAccountBalances, computeFinancialSummary, computeCashFlow } from '@/lib/finance'

// GET /api/reports/cash-flow — indirect method (Net Income → operating adjustments → investing → financing)
// Uses shared finance module so Net Income matches Income Statement and Balance Sheet.
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
  const cf = computeCashFlow(balances, summary.netIncome)

  return ok({
    from: from.toISOString(),
    to: to.toISOString(),
    netIncome: cf.netIncome,
    operatingAdjustments: cf.operatingAdjustments,
    totalOperatingAdjustments: cf.totalOperatingAdjustments,
    cashFromOperating: cf.cashFromOperating,
    investing: cf.investing,
    cashFromInvesting: cf.cashFromInvesting,
    financing: cf.financing,
    cashFromFinancing: cf.cashFromFinancing,
    netChangeInCash: cf.netChange,
    actualCashChange: cf.cashChange,
  })
}
