import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/reports/income-statement — for date range
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
    ? new Date(url.searchParams.get('from')!)
    : new Date('2026-01-01')
  const to = url.searchParams.get('to')
    ? new Date(url.searchParams.get('to')!)
    : new Date('2026-12-31')

  const journals = await db.journal.findMany({
    where: {
      organizationId: user.organizationId,
      status: 'Posted',
      journalDate: { gte: from, lte: to },
    },
    include: { lines: { include: { account: true } } },
  })

  const accounts = await db.account.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { code: 'asc' },
  })

  const bal: Record<string, { debit: number; credit: number }> = {}
  for (const j of journals) {
    for (const l of j.lines) {
      if (!l.accountId) continue
      if (!bal[l.accountId]) bal[l.accountId] = { debit: 0, credit: 0 }
      bal[l.accountId].debit += l.debit
      bal[l.accountId].credit += l.credit
    }
  }

  type Line = { code: string; name: string; amount: number }
  function buildLines(types: string[], subTypes?: string[]): Line[] {
    const lines: Line[] = []
    for (const a of accounts) {
      if (!types.includes(a.accountType)) continue
      if (subTypes && !subTypes.includes(a.subType || '')) continue
      if (a.subType === 'Header') continue
      const b = bal[a.id] || { debit: 0, credit: 0 }
      const net = b.debit - b.credit
      const amount = a.normalBalance === 'Debit' ? net : -net
      if (Math.abs(amount) < 0.005) continue
      lines.push({ code: a.code, name: a.name, amount })
    }
    return lines
  }

  const revenue = buildLines(['Revenue'])
  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0)

  const cogs = buildLines(['Expense'], ['COGS'])
  const totalCogs = cogs.reduce((s, r) => s + r.amount, 0)
  const grossProfit = totalRevenue - totalCogs

  const operatingExpenses = buildLines(['Expense'], ['Operating Expense'])
  const totalOperating = operatingExpenses.reduce((s, r) => s + r.amount, 0)

  const operatingIncome = grossProfit - totalOperating

  const otherIncome = buildLines(['Revenue'], ['Other Income'])
  const totalOtherIncome = otherIncome.reduce((s, r) => s + r.amount, 0)

  const otherExpenses = buildLines(['Expense'], ['Other Expense', 'Tax'])
  const totalOtherExpenses = otherExpenses.reduce((s, r) => s + r.amount, 0)

  const netIncome = operatingIncome + totalOtherIncome - totalOtherExpenses

  return ok({
    from: from.toISOString(),
    to: to.toISOString(),
    revenue,
    totalRevenue,
    cogs,
    totalCogs,
    grossProfit,
    operatingExpenses,
    totalOperating,
    operatingIncome,
    otherIncome,
    totalOtherIncome,
    otherExpenses,
    totalOtherExpenses,
    netIncome,
  })
}
