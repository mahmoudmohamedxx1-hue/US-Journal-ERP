import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { calculateDueDates, parsePaymentTermString, PAYMENT_TERM_PRESETS } from '@/lib/payment-terms'

/**
 * POST /api/payment-terms/calculate
 *
 * Odoo-inspired payment terms engine.
 * Calculates due dates for an invoice based on payment terms.
 *
 * Body:
 *   {
 *     invoiceDate: "2026-08-26",
 *     totalAmount: 1000000,  // cents
 *     paymentTerms: "Net 30"  // or "30% Immediate, 70% in 30 days"
 *   }
 *
 * Returns:
 *   {
 *     dueDates: [{ date, amount, percentage, label }]
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { invoiceDate, totalAmount, paymentTerms } = body

    if (!invoiceDate) return err('invoiceDate is required', 422, undefined, 'VALIDATION_ERROR')
    if (typeof totalAmount !== 'number') return err('totalAmount must be a number (cents)', 422, undefined, 'VALIDATION_ERROR')
    if (!paymentTerms) return err('paymentTerms is required', 422, undefined, 'VALIDATION_ERROR')

    const term = parsePaymentTermString(String(paymentTerms))
    const dueDates = calculateDueDates(new Date(invoiceDate), totalAmount, term)

    return ok({
      paymentTerm: term,
      dueDates: dueDates.map(d => ({
        date: d.date.toISOString(),
        amount: d.amount,
        percentage: d.percentage,
        label: d.label,
      })),
    })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}

/**
 * GET /api/payment-terms/calculate
 * Returns available payment term presets.
 */
export async function GET() {
  return ok({
    presets: PAYMENT_TERM_PRESETS.map(p => ({
      id: p.id,
      name: p.name,
      lines: p.lines,
    })),
  })
}
