import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { generateMonthlyCommentary } from '@/lib/ai/glm'
import { db } from '@/lib/db'

// POST /api/ai/monthly-commentary
// Body: { month: "YYYY-MM" }  (defaults to current month)
// Returns: { commentary: string }
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const month = String(body.month || new Date().toISOString().slice(0, 7))

    // Parse YYYY-MM
    const [year, mon] = month.split('-').map(Number)
    if (!year || !mon) return err('month must be YYYY-MM', 422)

    const startDate = new Date(Date.UTC(year, mon - 1, 1))
    const endDate = new Date(Date.UTC(year, mon, 0, 23, 59, 59))

    // Determine the org's base currency for display
    const org = await db.organization.findUnique({ where: { id: ctx.organizationId }, select: { currency: true, baseCurrency: true } })
    const currency = org?.baseCurrency || org?.currency || 'EGP'
    const fmtMoney = (cents: number) => formatCentsAsCurrency(cents, currency)

    // Pull income statement data
    const journals = await db.journal.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: 'Posted',
        journalDate: { gte: startDate, lte: endDate },
      },
      include: { lines: { include: { account: true } } },
    })

    let revenue = 0
    let expenses = 0
    const expenseByCategory: Record<string, number> = {}

    for (const j of journals) {
      for (const line of j.lines) {
        const acc = line.account
        if (!acc) continue
        const accType = (acc.accountType || '').toLowerCase()
        if (accType === 'revenue') {
          revenue += line.credit - line.debit
        } else if (accType === 'expense') {
          const amt = line.debit - line.credit
          expenses += amt
          expenseByCategory[acc.name] = (expenseByCategory[acc.name] || 0) + amt
        }
      }
    }

    const netIncome = revenue - expenses
    const topExpenseCategories = Object.entries(expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount: fmtMoney(amount) }))

    const result = await generateMonthlyCommentary({
      month,
      revenue: fmtMoney(revenue),
      expenses: fmtMoney(expenses),
      netIncome: fmtMoney(netIncome),
      topExpenseCategories,
    })

    return ok({ ai: result, commentary: result.data || null, month }, 200)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500)
  }
}

function formatCentsAsCurrency(cents: number, currency: string): string {
  const major = (cents || 0) / 100
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major)
  } catch {
    return `${currency} ${major.toFixed(2)}`
  }
}

