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
  return ok({ budgets })
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
