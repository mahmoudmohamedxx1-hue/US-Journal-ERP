import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { calculateEarlyPaymentDiscount, EARLY_PAYMENT_DISCOUNT_PRESETS } from '@/lib/payment-terms'

// GET /api/payment-terms/discount — list all early payment discount presets
export async function GET() {
  return ok({ presets: EARLY_PAYMENT_DISCOUNT_PRESETS })
}

// POST /api/payment-terms/discount — calculate early payment discount
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { invoiceDate, totalAmount, paymentDate, discountDays, discountPercent } = body
    const result = calculateEarlyPaymentDiscount(
      new Date(invoiceDate),
      totalAmount,
      new Date(paymentDate),
      { discountDays, discountPercent },
    )
    return ok({ result })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
