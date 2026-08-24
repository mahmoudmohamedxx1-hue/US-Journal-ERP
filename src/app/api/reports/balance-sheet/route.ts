import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/reports/balance-sheet — as-of reporting date
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const url = new URL(req.url)
  const asOf = url.searchParams.get('asOf')
    ? new Date(url.searchParams.get('asOf')!)
    : new Date('2026-12-31')

  const journals = await db.journal.findMany({
    where: {
      organizationId: DEMO_ORG_ID,
      status: 'Posted',
      journalDate: { lte: asOf },
    },
    include: { lines: { include: { account: true } } },
  })

  // Aggregate per account
  const bal: Record<string, { debit: number; credit: number }> = {}
  for (const j of journals) {
    for (const l of j.lines) {
      if (!l.accountId) continue
      if (!bal[l.accountId]) bal[l.accountId] = { debit: 0, credit: 0 }
      bal[l.accountId].debit += l.debit
      bal[l.accountId].credit += l.credit
    }
  }

  const accounts = await db.account.findMany({
    where: { organizationId: DEMO_ORG_ID },
    orderBy: { code: 'asc' },
  })

  // Build sectioned balance sheet
  type Section = {
    label: string
    items: Array<{ code: string; name: string; amount: number }>
    total: number
  }

  function buildSection(types: string[], headerLabel: string): Section {
    const items: Array<{ code: string; name: string; amount: number }> = []
    let total = 0
    for (const a of accounts) {
      if (!types.includes(a.accountType)) continue
      if (a.subType === 'Header') continue
      const b = bal[a.id] || { debit: 0, credit: 0 }
      const net = b.debit - b.credit
      const amount = a.normalBalance === 'Debit' ? net : -net
      if (Math.abs(amount) < 0.005) continue
      items.push({ code: a.code, name: a.name, amount })
      total += amount
    }
    return { label: headerLabel, items, total }
  }

  // ASSETS
  const currentAssets = buildSection(['Asset'], 'Current Assets')
    // Filter to current assets (split fixed assets out)
  const fixedAssets: Section = { label: 'Fixed Assets', items: [], total: 0 }
  const otherAssets: Section = { label: 'Other Assets', items: [], total: 0 }
  const currentAssetItems: Array<{ code: string; name: string; amount: number }> = []
  let currentAssetTotal = 0
  for (const item of currentAssets.items) {
    const acct = accounts.find((a) => a.code === item.code)
    if (acct?.subType === 'Fixed Asset') {
      fixedAssets.items.push(item)
      fixedAssets.total += item.amount
    } else if (acct?.subType === 'Other Asset' || acct?.subType === 'Intangible') {
      otherAssets.items.push(item)
      otherAssets.total += item.amount
    } else {
      currentAssetItems.push(item)
      currentAssetTotal += item.amount
    }
  }
  const totalAssets = currentAssetTotal + fixedAssets.total + otherAssets.total

  // LIABILITIES
  const liabilities = buildSection(['Liability'], 'Liabilities')
  const currentLiab: Section = { label: 'Current Liabilities', items: [], total: 0 }
  const longTermLiab: Section = { label: 'Long-term Liabilities', items: [], total: 0 }
  for (const item of liabilities.items) {
    const acct = accounts.find((a) => a.code === item.code)
    if (acct?.subType === 'Long-term Liability') {
      longTermLiab.items.push(item)
      longTermLiab.total += item.amount
    } else {
      currentLiab.items.push(item)
      currentLiab.total += item.amount
    }
  }
  const totalLiabilities = currentLiab.total + longTermLiab.total

  // EQUITY
  const equity = buildSection(['Equity'], 'Equity')
  // Compute net income (YTD revenue - YTD expenses) — closed into equity on the BS
  let netIncome = 0
  for (const a of accounts) {
    const b = bal[a.id] || { debit: 0, credit: 0 }
    const net = b.debit - b.credit
    if (a.accountType === 'Revenue') netIncome += -net // credit increases revenue
    else if (a.accountType === 'Expense') netIncome += net // debit increases expense
  }

  const totalEquity = equity.total + netIncome
  const totalLiabAndEquity = totalLiabilities + totalEquity

  return ok({
    asOf: asOf.toISOString(),
    sections: {
      currentAssets: { label: 'Current Assets', items: currentAssetItems, total: currentAssetTotal },
      fixedAssets,
      otherAssets,
      totalAssets,
      currentLiabilities: currentLiab,
      longTermLiabilities: longTermLiab,
      totalLiabilities,
      equity,
      netIncome,
      totalEquity,
      totalLiabilitiesAndEquity: totalLiabAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabAndEquity) < 0.01,
    },
  })
}
