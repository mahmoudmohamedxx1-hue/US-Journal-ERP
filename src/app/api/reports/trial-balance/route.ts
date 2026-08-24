import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok } from '@/lib/api'

// GET /api/reports/trial-balance
// Returns per-account: opening balance, period movement, ending balance (debit/credit columns)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const asOf = url.searchParams.get('asOf')
    ? new Date(url.searchParams.get('asOf')!)
    : new Date('2026-12-31')
  const from = url.searchParams.get('from')
    ? new Date(url.searchParams.get('from')!)
    : new Date('2026-01-01')

  const accounts = await db.account.findMany({
    where: { organizationId: DEMO_ORG_ID, subType: { not: 'Header' } },
    orderBy: { code: 'asc' },
  })

  // Pull all posted journal lines in the period
  const journals = await db.journal.findMany({
    where: {
      organizationId: DEMO_ORG_ID,
      status: 'Posted',
      journalDate: { lte: asOf },
    },
    include: { lines: { include: { account: true } } },
  })

  // Aggregate per account
  const accountMovement: Record<string, { debit: number; credit: number }> = {}
  for (const j of journals) {
    for (const l of j.lines) {
      if (!l.accountId) continue
      if (!accountMovement[l.accountId]) {
        accountMovement[l.accountId] = { debit: 0, credit: 0 }
      }
      // Only count movements within the selected range for the "movement" column
      if (j.journalDate >= from) {
        accountMovement[l.accountId].debit += l.debit
        accountMovement[l.accountId].credit += l.credit
      }
    }
  }

  // Compute ending balance per account (all posted activity up to asOf)
  const accountBalance: Record<string, { debit: number; credit: number }> = {}
  for (const j of journals) {
    for (const l of j.lines) {
      if (!l.accountId) continue
      if (!accountBalance[l.accountId]) {
        accountBalance[l.accountId] = { debit: 0, credit: 0 }
      }
      accountBalance[l.accountId].debit += l.debit
      accountBalance[l.accountId].credit += l.credit
    }
  }

  const rows = accounts.map((a) => {
    const mov = accountMovement[a.id] || { debit: 0, credit: 0 }
    const bal = accountBalance[a.id] || { debit: 0, credit: 0 }
    const netDebit = bal.debit - bal.credit
    const isDebit = a.normalBalance === 'Debit'
    return {
      code: a.code,
      name: a.name,
      accountType: a.accountType,
      subType: a.subType,
      openingDebit: 0, // demo opening balances
      openingCredit: 0,
      movementDebit: mov.debit,
      movementCredit: mov.credit,
      totalDebit: bal.debit,
      totalCredit: bal.credit,
      endingDebit: isDebit ? Math.max(0, netDebit) : 0,
      endingCredit: !isDebit ? Math.max(0, -netDebit) : 0,
    }
  })

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
