/**
 * US Journal ERP — Shared Financial Calculations Module
 *
 * Inspired by Odoo's account_report.py — all financial reports share a single
 * calculation engine so revenue, expenses, and net income are IDENTICAL across
 * Dashboard, Trial Balance, Balance Sheet, Income Statement, and Cash Flow.
 *
 * Core principle: balance = debit - credit (signed)
 * - Asset/Expense accounts: positive balance = debit-heavy (normal)
 * - Liability/Equity/Revenue accounts: negative balance = credit-heavy (normal)
 *
 * Usage:
 *   import { computeAccountBalances, computeNetIncome, computeBalanceSheet } from '@/lib/finance'
 *   const balances = await computeAccountBalances({ organizationId, from, to })
 *   const ni = computeNetIncome(balances)
 */

import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountBalance {
  id: string
  code: string
  name: string
  accountType: string    // Asset, Liability, Equity, Revenue, Expense
  subType: string | null
  normalBalance: string  // Debit or Credit
  openingDebit: number
  openingCredit: number
  movementDebit: number
  movementCredit: number
  totalDebit: number
  totalCredit: number
  endingDebit: number
  endingCredit: number
  netBalance: number     // signed: debit - credit (positive = debit-heavy)
}

export interface FinancialSummary {
  // Operating revenue (excludes "Other Income" subType)
  operatingRevenue: number
  // Other income (subType = "Other Income")
  otherIncome: number
  // Total revenue (operating + other)
  totalRevenue: number
  // COGS (subType = "COGS")
  costOfGoodsSold: number
  // Operating expenses (subType = "Operating Expense")
  operatingExpenses: number
  // Other expenses (subType = "Other Expense" or "Tax")
  otherExpenses: number
  // Gross profit = operatingRevenue - COGS
  grossProfit: number
  // Operating income = grossProfit - operatingExpenses
  operatingIncome: number
  // Net income = operatingIncome + otherIncome - otherExpenses
  netIncome: number
  // Total assets
  totalAssets: number
  // Total liabilities
  totalLiabilities: number
  // Total equity (excluding net income)
  totalEquity: number
  // Total liabilities + equity (including net income)
  totalLiabilitiesAndEquity: number
}

// ---------------------------------------------------------------------------
// Core: Compute account balances for a date range
// ---------------------------------------------------------------------------

export interface BalanceQuery {
  organizationId: string
  asOf: Date          // ending date (inclusive)
  from?: Date         // opening date (for movement calc); defaults to start of year
}

/**
 * Compute balances for ALL accounts in the organization.
 *
 * For each account:
 *   - openingDebit/openingCredit: balance BEFORE `from` date (0 if not provided)
 *   - movementDebit/movementCredit: activity BETWEEN from and asOf
 *   - totalDebit/totalCredit: cumulative up to asOf
 *   - endingDebit/endingCredit: net position (only one is non-zero, based on normalBalance)
 *   - netBalance: signed (debit - credit)
 *
 * This is the SINGLE SOURCE OF TRUTH that all reports use.
 */
export async function computeAccountBalances(query: BalanceQuery): Promise<AccountBalance[]> {
  const { organizationId, asOf, from } = query
  const fromDate = from || new Date(new Date(asOf).getFullYear(), 0, 1)

  const accounts = await db.account.findMany({
    where: { organizationId },
    orderBy: { code: 'asc' },
  })

  // Pull all posted journal lines up to asOf
  const journals = await db.journal.findMany({
    where: {
      organizationId,
      status: 'Posted',
      journalDate: { lte: asOf },
    },
    include: { lines: { include: { account: true } } },
  })

  // Aggregate per account
  const opening: Record<string, { debit: number; credit: number }> = {}
  const movement: Record<string, { debit: number; credit: number }> = {}
  const total: Record<string, { debit: number; credit: number }> = {}

  for (const j of journals) {
    for (const l of j.lines) {
      if (!l.accountId) continue
      if (!opening[l.accountId]) opening[l.accountId] = { debit: 0, credit: 0 }
      if (!movement[l.accountId]) movement[l.accountId] = { debit: 0, credit: 0 }
      if (!total[l.accountId]) total[l.accountId] = { debit: 0, credit: 0 }

      // Total = all activity up to asOf
      total[l.accountId].debit += l.debit
      total[l.accountId].credit += l.credit

      // Movement = activity within from..asOf range
      if (j.journalDate >= fromDate) {
        movement[l.accountId].debit += l.debit
        movement[l.accountId].credit += l.credit
      } else {
        // Before from date = opening balance
        opening[l.accountId].debit += l.debit
        opening[l.accountId].credit += l.credit
      }
    }
  }

  return accounts
    .filter(a => a.subType !== 'Header')
    .map(a => {
      const op = opening[a.id] || { debit: 0, credit: 0 }
      const mov = movement[a.id] || { debit: 0, credit: 0 }
      const tot = total[a.id] || { debit: 0, credit: 0 }
      const netDebit = tot.debit - tot.credit
      const isDebitNormal = a.normalBalance === 'Debit'
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        accountType: a.accountType,
        subType: a.subType,
        normalBalance: a.normalBalance,
        openingDebit: op.debit,
        openingCredit: op.credit,
        movementDebit: mov.debit,
        movementCredit: mov.credit,
        totalDebit: tot.debit,
        totalCredit: tot.credit,
        endingDebit: isDebitNormal ? Math.max(0, netDebit) : 0,
        endingCredit: !isDebitNormal ? Math.max(0, -netDebit) : 0,
        netBalance: netDebit,
      }
    })
}

// ---------------------------------------------------------------------------
// Derived: Financial Summary (Income Statement + Balance Sheet)
// ---------------------------------------------------------------------------

/**
 * Compute the financial summary from account balances.
 *
 * Revenue classification:
 *   - Operating Revenue: accountType=Revenue AND subType != 'Other Income'
 *   - Other Income: accountType=Revenue AND subType = 'Other Income'
 *
 * Expense classification:
 *   - COGS: accountType=Expense AND subType = 'COGS'
 *   - Operating Expense: accountType=Expense AND subType = 'Operating Expense'
 *   - Other Expense: accountType=Expense AND subType IN ('Other Expense', 'Tax')
 *
 * For Revenue accounts: amount = credit - debit (credit increases revenue)
 * For Expense accounts: amount = debit - credit (debit increases expense)
 * For Asset accounts: amount = debit - credit (debit increases asset)
 * For Liability/Equity: amount = credit - debit (credit increases liability/equity)
 */
export function computeFinancialSummary(balances: AccountBalance[]): FinancialSummary {
  let operatingRevenue = 0
  let otherIncome = 0
  let costOfGoodsSold = 0
  let operatingExpenses = 0
  let otherExpenses = 0
  let totalAssets = 0
  let totalLiabilities = 0
  let totalEquity = 0

  for (const a of balances) {
    const type = a.accountType
    const sub = (a.subType || '').toLowerCase()
    const net = a.netBalance  // debit - credit (signed)

    if (type === 'Revenue') {
      // Revenue has credit-normal balance: amount = credit - debit = -net
      const amount = -net
      if (sub === 'other income') {
        otherIncome += amount
      } else {
        operatingRevenue += amount
      }
    } else if (type === 'Expense') {
      // Expense has debit-normal balance: amount = debit - credit = net
      const amount = net
      if (sub === 'cogs') {
        costOfGoodsSold += amount
      } else if (sub === 'operating expense') {
        operatingExpenses += amount
      } else if (sub === 'other expense' || sub === 'tax') {
        otherExpenses += amount
      } else {
        // Default: treat as operating expense if subType doesn't match known categories
        operatingExpenses += amount
      }
    } else if (type === 'Asset') {
      // Contra-assets (accumulated depreciation) reduce total assets
      // Detect via name pattern
      const isContraAsset = a.name.toLowerCase().includes('accumulated depreciation') ||
        a.name.toLowerCase().includes('accum dep') ||
        a.name.toLowerCase().includes('accumdep')
      if (isContraAsset) {
        // Contra-asset has credit balance (negative net), display as negative
        totalAssets -= Math.abs(-net)
      } else {
        totalAssets += net
      }
    } else if (type === 'Liability') {
      // Liability has credit-normal: amount = credit - debit = -net
      totalLiabilities += -net
    } else if (type === 'Equity') {
      // Equity has credit-normal: amount = credit - debit = -net
      totalEquity += -net
    }
  }

  const totalRevenue = operatingRevenue + otherIncome
  const grossProfit = operatingRevenue - costOfGoodsSold
  const operatingIncome = grossProfit - operatingExpenses
  const netIncome = operatingIncome + otherIncome - otherExpenses
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netIncome

  return {
    operatingRevenue,
    otherIncome,
    totalRevenue,
    costOfGoodsSold,
    operatingExpenses,
    otherExpenses,
    grossProfit,
    operatingIncome,
    netIncome,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
  }
}

// ---------------------------------------------------------------------------
// Cash Flow: Detect cash accounts and compute components
// ---------------------------------------------------------------------------

export function isCashAccount(a: AccountBalance): boolean {
  if (a.accountType !== 'Asset' || a.subType !== 'Current Asset') return false
  const name = a.name.toLowerCase()
  return name.includes('cash') ||
    name.includes('checking') ||
    name.includes('savings') ||
    name.includes('bank') ||
    name.includes('petty cash')
}

export function isContraAsset(a: AccountBalance): boolean {
  const name = a.name.toLowerCase()
  return name.includes('accumulated depreciation') ||
    name.includes('accum dep') ||
    name.includes('accumdep')
}

/**
 * Compute cash flow statement components (indirect method).
 *
 * Operating Activities:
 *   Net Income
 *   + Depreciation (contra-asset credit balance increase)
 *   - Increase in non-cash current assets (AR, inventory, prepaid)
 *   + Increase in current liabilities (AP, accrued, tax payable)
 *
 * Investing Activities:
 *   - Increase in fixed assets (cash outflow)
 *   + Proceeds from asset disposal
 *
 * Financing Activities:
 *   + Increase in equity (capital contribution)
 *   + Increase in long-term liabilities (loan proceeds)
 *   - Dividends/distributions
 */
export function computeCashFlow(balances: AccountBalance[], netIncome: number) {
  const operatingAdjustments: Array<{ code: string; name: string; amount: number }> = []
  const investing: Array<{ code: string; name: string; amount: number }> = []
  const financing: Array<{ code: string; name: string; amount: number }> = []
  let cashChange = 0

  for (const a of balances) {
    const net = a.netBalance  // debit - credit (signed)

    // Depreciation add-back (contra-asset)
    if (isContraAsset(a)) {
      // Contra-asset has credit balance (negative net), add back as positive
      const amt = -net  // credit increase = positive cash adjustment
      if (Math.abs(amt) > 0.005) operatingAdjustments.push({ code: a.code, name: a.name, amount: amt })
      continue
    }

    // Non-cash current assets (AR, inventory, prepaid, etc.)
    if (a.accountType === 'Asset' && a.subType === 'Current Asset' && !isCashAccount(a)) {
      // Increase in asset = cash outflow (negative adjustment)
      const amt = -net
      if (Math.abs(amt) > 0.005) operatingAdjustments.push({ code: a.code, name: a.name, amount: amt })
      continue
    }

    // Current liabilities (AP, accrued, tax payable)
    if (a.accountType === 'Liability' && a.subType === 'Current Liability') {
      // Increase in liability = cash inflow (positive adjustment)
      // Liability is credit-normal: net = debit - credit = negative when credit increases
      // So -net = positive when liability increases
      const amt = -net
      if (Math.abs(amt) > 0.005) operatingAdjustments.push({ code: a.code, name: a.name, amount: amt })
      continue
    }

    // Investing: fixed assets, intangibles, other assets
    if (a.accountType === 'Asset' &&
        (a.subType === 'Fixed Asset' || a.subType === 'Intangible' || a.subType === 'Other Asset') &&
        !isContraAsset(a)) {
      // Increase in asset = cash outflow
      const amt = -net
      if (Math.abs(amt) > 0.005) investing.push({ code: a.code, name: a.name, amount: amt })
      continue
    }

    // Financing: equity and long-term liabilities
    if (a.accountType === 'Equity') {
      // Equity increase = cash inflow
      const amt = -net
      if (Math.abs(amt) > 0.005) financing.push({ code: a.code, name: a.name, amount: amt })
      continue
    }
    if (a.accountType === 'Liability' && a.subType === 'Long-term Liability') {
      // Long-term liability increase = cash inflow
      const amt = -net
      if (Math.abs(amt) > 0.005) financing.push({ code: a.code, name: a.name, amount: amt })
      continue
    }

    // Cash accounts — for computing net change in cash
    if (isCashAccount(a)) {
      cashChange += net  // debit increase = cash increase
    }
  }

  const totalOperatingAdjustments = operatingAdjustments.reduce((s, r) => s + r.amount, 0)
  const cashFromOperating = netIncome + totalOperatingAdjustments
  const cashFromInvesting = investing.reduce((s, r) => s + r.amount, 0)
  const cashFromFinancing = financing.reduce((s, r) => s + r.amount, 0)

  return {
    netIncome,
    operatingAdjustments,
    totalOperatingAdjustments,
    cashFromOperating,
    investing,
    cashFromInvesting,
    financing,
    cashFromFinancing,
    cashChange,
    // Net change = operating + investing + financing (should match cashChange)
    netChange: cashFromOperating + cashFromInvesting + cashFromFinancing,
  }
}
