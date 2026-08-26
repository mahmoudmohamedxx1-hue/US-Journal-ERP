import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from "@/lib/api"

// GET /api/reports/cash-flow — indirect method (Net Income → operating adjustments → investing → financing)
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
    ? new Date(url.searchParams.get('from')!)
    : new Date('2026-01-01')
  const to = url.searchParams.get('to')
    ? new Date(url.searchParams.get('to')!)
    : new Date('2026-12-31')

  const journals = await db.journal.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: 'Posted',
      journalDate: { gte: from, lte: to },
    },
    include: { lines: { include: { account: true } } },
  })

  const accounts = await db.account.findMany({
    where: { organizationId: ctx.organizationId },
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
    else if (a.accountType === 'Expense') netIncome -= net  // expenses reduce net income
  }

  // Operating adjustments: changes in non-cash current assets/liabilities + depreciation
  const operatingAdjustments: Array<{ code: string; name: string; amount: number }> = []
  for (const a of accounts) {
    if (a.subType === 'Header') continue
    // Depreciation is added back (positive) — match "accumulated depreciation" OR "accum dep"
    const lowerName = a.name.toLowerCase()
    const isAccumDep = lowerName.includes('accumulated depreciation') || lowerName.includes('accum dep') || lowerName.includes('accumdep')
    if (a.accountType === 'Asset' && isAccumDep) {
      const amt = -netFor(a.id) // credit balance increases, add back as positive
      if (Math.abs(amt) > 0.005) operatingAdjustments.push({ code: a.code, name: a.name, amount: amt })
      continue
    }
    // Detect cash-equivalent accounts: cash, checking, savings, bank
    const isCashAccount = a.accountType === 'Asset' && a.subType === 'Current Asset' && (
      lowerName.includes('cash') || lowerName.includes('checking') ||
      lowerName.includes('savings') || lowerName.includes('bank') ||
      lowerName.includes('petty cash')
    )
    // Other non-cash current assets / current liabilities changes
    if (a.accountType === 'Asset' && a.subType === 'Current Asset' && !isCashAccount) {
      // Asset is debit-normal — Dr increase means asset went up = cash went down
      const amt = -netFor(a.id)
      if (Math.abs(amt) > 0.005) operatingAdjustments.push({ code: a.code, name: a.name, amount: amt })
    } else if (a.accountType === 'Liability' && a.subType === 'Current Liability') {
      // Liability is credit-normal — Cr increase (Dr-Cr net is negative) means liab went up = cash went up
      const amt = -netFor(a.id)
      if (Math.abs(amt) > 0.005) operatingAdjustments.push({ code: a.code, name: a.name, amount: amt })
    }
  }
  const totalOperatingAdjustments = operatingAdjustments.reduce((s, r) => s + r.amount, 0)
  const cashFromOperating = netIncome + totalOperatingAdjustments

  // Investing — fixed asset and intangible activity
  const investing: Array<{ code: string; name: string; amount: number }> = []
  for (const a of accounts) {
    if (a.subType === 'Header') continue
    const lowerName = a.name.toLowerCase()
    const isAccumDep = lowerName.includes('accumulated depreciation') || lowerName.includes('accum dep') || lowerName.includes('accumdep')
    if (a.accountType === 'Asset' &&
        (a.subType === 'Fixed Asset' || a.subType === 'Intangible' || a.subType === 'Other Asset') &&
        !isAccumDep) {
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
      // Equity is credit-normal — credit increases (Dr-Cr net is negative) = positive cash inflow
      const amt = -netFor(a.id)
      if (Math.abs(amt) > 0.005) financing.push({ code: a.code, name: a.name, amount: amt })
    } else if (a.accountType === 'Liability' && a.subType === 'Long-term Liability') {
      // Long-term liability is also credit-normal — credit increases = positive cash inflow
      const amt = -netFor(a.id)
      if (Math.abs(amt) > 0.005) financing.push({ code: a.code, name: a.name, amount: amt })
    }
  }
  const cashFromFinancing = financing.reduce((s, r) => s + r.amount, 0)

  // Net change in cash — same detection logic as operating adjustments
  let cashChange = 0
  for (const a of accounts) {
    if (a.subType === 'Header') continue
    if (a.accountType !== 'Asset' || a.subType !== 'Current Asset') continue
    const lowerName = a.name.toLowerCase()
    const isCashAccount = lowerName.includes('cash') || lowerName.includes('checking') ||
      lowerName.includes('savings') || lowerName.includes('bank') ||
      lowerName.includes('petty cash')
    if (isCashAccount) {
      cashChange += netFor(a.id)  // debit-normal: Dr increase = cash increase
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
