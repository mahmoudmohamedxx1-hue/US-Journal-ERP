import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from "@/lib/api"
import { computeAccountBalances } from '@/lib/finance'

// GET /api/reports/trial-balance
// Returns per-account: opening balance, period movement, ending balance (debit/credit columns)
// Uses the shared finance module so revenue is consistent across all reports.
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const asOf = url.searchParams.get('asOf')
    ? new Date(url.searchParams.get('asOf')!)
    : new Date('2026-12-31')
  const from = url.searchParams.get('from')
    ? new Date(url.searchParams.get('from')!)
    : new Date('2026-01-01')

  const balances = await computeAccountBalances({
    organizationId: ctx.organizationId,
    asOf,
    from,
  })

  const rows = balances.map(b => ({
    code: b.code,
    name: b.name,
    accountType: b.accountType,
    subType: b.subType,
    openingDebit: b.openingDebit,
    openingCredit: b.openingCredit,
    movementDebit: b.movementDebit,
    movementCredit: b.movementCredit,
    totalDebit: b.totalDebit,
    totalCredit: b.totalCredit,
    endingDebit: b.endingDebit,
    endingCredit: b.endingCredit,
  }))

  const totalDebit = rows.reduce((s, r) => s + r.endingDebit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.endingCredit, 0)

  return ok({
    asOf: asOf.toISOString(),
    from: from.toISOString(),
    rows,
    totals: { debit: totalDebit, credit: totalCredit },
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  })
}
