import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/exchange-rates
export async function GET() {
  const ctx = await getSystemContext()
  const rates = await db.exchangeRate.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { date: 'desc' },
  })
  return ok({ exchangeRates: rates })
}

// POST /api/exchange-rates
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { fromCurrency, toCurrency, rate, date } = body
    if (!fromCurrency || !toCurrency || !rate || !date) {
      return err('fromCurrency, toCurrency, rate, date are required', 422, undefined, 'VALIDATION_ERROR')
    }
    const exchangeRate = await db.exchangeRate.create({
      data: {
        organizationId: ctx.organizationId,
        fromCurrency: String(fromCurrency).toUpperCase(),
        toCurrency: String(toCurrency).toUpperCase(),
        rate: Math.round(Number(rate) * 100), // store as basis points
        date: new Date(date),
      },
    })
    return ok({ exchangeRate }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
