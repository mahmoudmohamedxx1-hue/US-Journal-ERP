import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/reports/cash-flow — indirect method (Net Income → operating adjustments → investing → financing)
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

  function netFor(acctId: string) {
    const b = bal[acctId] || { debit: 0, credit: 0 }
    return b.debit - b.credit
  }

  // Compute net income (same as income statement)
  let netIncome = 0
  for (const a of accounts) {
    const net = netFor(a.id)
    if (a.accountType === 'Revenue') netIncome += -net
    else if (a.accountType === 'Expense') netIncome += net
  }

  // Operating adjustments: changes in non-cash current assets/liabilities + depreciation
  const operatingAdjustments: Array<{ code: string; name: string; amount: number }> = []
  for (const a of accounts) {
    if (a.subType === 'Header') continue
    // Depreciation is added back (positive)
    if (a.accountType === 'Asset' && a.name.toLowerCase().includes('accumulated depreciation')) {
      const amt = -netFor(a.id) // credit balance increases, add back as positive
      if (Math.abs(amt) > 0.005) operatingAdjustments.push({ code: a.code, name: a.name, amount: amt })
      continue
    }
    // Other non-cash current assets / current liabilities changes
    if (a.accountType === 'Asset' && a.subType === 'Current Asset' &&
        !a.name.toLowerCase().includes('cash')) {
      const amt = -netFor(a.id) // increase in asset = decrease in cash
      if (Math.abs(amt) > 0.005) operatingAdjustments.push({ code: a.code, name: a.name, amount: amt })
    } else if (a.accountType === 'Liability' && a.subType === 'Current Liability') {
      const amt = netFor(a.id) // increase in liab = increase in cash
      if (Math.abs(amt) > 0.005) operatingAdjustments.push({ code: a.code, name: a.name, amount: amt })
    }
  }
  const totalOperatingAdjustments = operatingAdjustments.reduce((s, r) => s + r.amount, 0)
  const cashFromOperating = netIncome + totalOperatingAdjustments

  // Investing — fixed asset and intangible activity
  const investing: Array<{ code: string; name: string; amount: number }> = []
  for (const a of accounts) {
    if (a.subType === 'Header') continue
    if (a.accountType === 'Asset' &&
        (a.subType === 'Fixed Asset' || a.subType === 'Intangible' || a.subType === 'Other Asset') &&
        !a.name.toLowerCase().includes('accumulated depreciation')) {
      const amt = -netFor(a.id) // increase in asset = cash outflow
      if (Math.abs(amt) > 0.005) investing.push({ code: a.code, name: a.name, amount: amt })
    }
  }
  const cashFromInvesting = investing.reduce((s, r) => s + r.amount, 0)

  // Financing — equity and long-term liability activity
  const financing: Array<{ code: string; name: string; amount: number }> = []
  for (const a of accounts) {
    if (a.subType === 'Header') continue
    if (a.accountType === 'Equity') {
      const amt = netFor(a.id) // credit balance increases = cash inflow
      if (Math.abs(amt) > 0.005) financing.push({ code: a.code, name: a.name, amount: amt })
    } else if (a.accountType === 'Liability' && a.subType === 'Long-term Liability') {
      const amt = netFor(a.id)
      if (Math.abs(amt) > 0.005) financing.push({ code: a.code, name: a.name, amount: amt })
    }
  }
  const cashFromFinancing = financing.reduce((s, r) => s + r.amount, 0)

  // Net change in cash
  let cashChange = 0
  for (const a of accounts) {
    if (a.accountType === 'Asset' && a.subType === 'Current Asset' &&
        a.name.toLowerCase().includes('cash')) {
      cashChange += netFor(a.id)
    }
  }

  return ok({
    from: from.toISOString(),
    to: to.toISOString(),
    netIncome,
    operatingAdjustments,
    totalOperatingAdjustments,
    cashFromOperating,
    investing,
    cashFromInvesting,
    financing,
    cashFromFinancing,
    netChangeInCash: cashChange,
    // In a demo with limited history, the computed cash change from journals
    // may not reconcile to bank balances because of opening balances.
  })
}
