import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/budgets
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const accountId = url.searchParams.get('accountId')
  const period = url.searchParams.get('period')

  const where: Record<string, unknown> = { organizationId: ctx.organizationId }
  if (accountId) where.accountId = accountId
  if (period) where.period = period

  const budgets = await db.budget.findMany({
    where,
    include: { account: true },
    orderBy: [{ period: 'desc' }, { account: { code: 'asc' } }],
  })

  // Compute actual amounts from posted journal lines for each budget's account + period
  // Period format: "2026" (full year) or "2026-01" (specific month)
  const enrichedBudgets = await Promise.all(budgets.map(async (b) => {
    let startDate: Date
    let endDate: Date
    if (b.period.length === 4) {
      // Full year
      const year = parseInt(b.period)
      startDate = new Date(Date.UTC(year, 0, 1))
      endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59))
    } else {
      // YYYY-MM
      const [year, month] = b.period.split('-').map(Number)
      startDate = new Date(Date.UTC(year, month - 1, 1))
      endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))
    }

    // Sum all posted journal lines for this account in the period
    const lines = await db.journalLine.findMany({
      where: {
        accountId: b.accountId,
        journal: {
          organizationId: ctx.organizationId,
          status: 'Posted',
          journalDate: { gte: startDate, lte: endDate },
        },
      },
      select: { debit: true, credit: true },
    })

    let actualAmount = 0
    for (const l of lines) {
      // For revenue/expense: actual = credit - debit (revenue) or debit - credit (expense)
      // For balance sheet accounts: just the net movement
      const accType = (b.account?.accountType || '').toLowerCase()
      if (accType === 'revenue') {
        actualAmount += l.credit - l.debit
      } else if (accType === 'expense') {
        actualAmount += l.debit - l.credit
      } else {
        // Asset/Liability: debit-positive
        actualAmount += l.debit - l.credit
      }
    }

    return {
      ...b,
      actualAmount,
    }
  }))

  return ok({ budgets: enrichedBudgets })
}

// POST /api/budgets
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { accountId, period, budgetAmount, fiscalYearId } = body

    if (!accountId) return err('Account is required', 422, undefined, 'VALIDATION_ERROR')
    if (!period) return err('Period is required (e.g. "2026" or "2026-01")', 422, undefined, 'VALIDATION_ERROR')
    if (!budgetAmount || budgetAmount <= 0) return err('Budget amount must be positive', 422, undefined, 'VALIDATION_ERROR')

    const existing = await db.budget.findFirst({
      where: { organizationId: ctx.organizationId, accountId, period },
    })
    if (existing) {
      // Update existing budget
      const updated = await db.budget.update({
        where: { id: existing.id },
        data: { budgetAmount: Math.round(Number(budgetAmount) * 100) },
      })
      return ok({ budget: updated })
    }

    const budget = await db.budget.create({
      data: {
        organizationId: ctx.organizationId,
        accountId,
        fiscalYearId: fiscalYearId || null,
        period,
        budgetAmount: Math.round(Number(budgetAmount) * 100),
        actualAmount: 0,
      },
      include: { account: true },
    })
    return ok({ budget }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create budget', 500, undefined, 'INTERNAL_ERROR')
  }
}
