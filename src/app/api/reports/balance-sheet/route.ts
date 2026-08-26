import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from "@/lib/api"
import { computeAccountBalances, computeFinancialSummary, isContraAsset, type AccountBalance } from '@/lib/finance'

// GET /api/reports/balance-sheet — as-of reporting date
// Uses shared finance module so Net Income matches Income Statement and Cash Flow.
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const asOf = url.searchParams.get('asOf')
    ? new Date(url.searchParams.get('asOf')!)
    : new Date('2026-12-31')

  const balances = await computeAccountBalances({
    organizationId: ctx.organizationId,
    asOf,
  })

  const summary = computeFinancialSummary(balances)

  // Build sections
  type Section = {
    label: string
    items: Array<{ code: string; name: string; amount: number }>
    total: number
  }

  function buildSection(accounts: AccountBalance[], sign: 1 | -1 = 1): { items: Array<{ code: string; name: string; amount: number }>; total: number } {
    const items: Array<{ code: string; name: string; amount: number }> = []
    let total = 0
    for (const a of accounts) {
      const net = a.netBalance
      // For Asset accounts (debit-normal): amount = net (debit - credit)
      // For Liability/Equity accounts (credit-normal): amount = -net (credit - debit)
      let amount = sign === 1 ? net : -net
      // Contra-assets shown as negative deduction
      if (isContraAsset(a)) {
        amount = -Math.abs(amount)
      }
      if (Math.abs(amount) < 0.005) continue
      items.push({ code: a.code, name: a.name, amount })
      total += amount
    }
    return { items, total }
  }

  // ASSETS
  const assetAccounts = balances.filter(a => a.accountType === 'Asset')
  const currentAssetAccounts = assetAccounts.filter(a => a.subType === 'Current Asset')
  const fixedAssetAccounts = assetAccounts.filter(a => a.subType === 'Fixed Asset')
  const otherAssetAccounts = assetAccounts.filter(a =>
    a.subType === 'Other Asset' || a.subType === 'Intangible'
  )

  const currentAssets = buildSection(currentAssetAccounts, 1)
  const fixedAssets = buildSection(fixedAssetAccounts, 1)
  const otherAssets = buildSection(otherAssetAccounts, 1)

  // LIABILITIES
  const liabilityAccounts = balances.filter(a => a.accountType === 'Liability')
  const currentLiabAccounts = liabilityAccounts.filter(a => a.subType === 'Current Liability')
  const longTermLiabAccounts = liabilityAccounts.filter(a => a.subType === 'Long-term Liability')

  const currentLiabilities = buildSection(currentLiabAccounts, -1)
  const longTermLiabilities = buildSection(longTermLiabAccounts, -1)

  // EQUITY
  const equityAccounts = balances.filter(a => a.accountType === 'Equity')
  const equity = buildSection(equityAccounts, -1)

  const totalAssets = currentAssets.total + fixedAssets.total + otherAssets.total
  const totalLiabilities = currentLiabilities.total + longTermLiabilities.total
  const totalEquity = equity.total
  const totalLiabAndEquity = totalLiabilities + totalEquity + summary.netIncome

  return ok({
    asOf: asOf.toISOString(),
    sections: {
      currentAssets: { label: 'Current Assets', ...currentAssets },
      fixedAssets: { label: 'Fixed Assets', ...fixedAssets },
      otherAssets: { label: 'Other Assets', ...otherAssets },
      totalAssets,
      currentLiabilities: { label: 'Current Liabilities', ...currentLiabilities },
      longTermLiabilities: { label: 'Long-term Liabilities', ...longTermLiabilities },
      totalLiabilities,
      equity: { label: 'Equity', ...equity },
      netIncome: summary.netIncome,
      totalEquity,
      totalLiabilitiesAndEquity: totalLiabAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabAndEquity) < 0.01,
    },
  })
}
