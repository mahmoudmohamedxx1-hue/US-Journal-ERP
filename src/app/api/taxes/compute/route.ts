import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { computeTaxes, loadTaxCodes, generateTaxJournalLines } from '@/lib/tax-engine'

/**
 * POST /api/taxes/compute
 *
 * Odoo-inspired tax computation engine.
 *
 * Body:
 *   {
 *     priceUnit: 100,       // unit price in dollars
 *     quantity: 2,          // quantity
 *     taxIds: ["t1","t2"],  // tax code IDs
 *     priceIncludesTax: false,
 *     isRefund: false
 *   }
 *
 * Returns:
 *   {
 *     total_excluded: 20000,  // cents
 *     total_included: 22000,  // cents (if 10% tax)
 *     taxes: [{ id, name, base, amount, rate, account }]
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { priceUnit, quantity = 1, taxIds = [], priceIncludesTax = false, isRefund = false } = body

    if (typeof priceUnit !== 'number' || priceUnit < 0) {
      return err('priceUnit must be a non-negative number', 422, undefined, 'VALIDATION_ERROR')
    }

    const taxCodes = await loadTaxCodes(ctx.organizationId, taxIds)
    const result = computeTaxes(priceUnit, quantity, taxCodes, { priceIncludesTax, isRefund })

    return ok({
      ...result,
      taxJournalLines: generateTaxJournalLines(result.taxes, true),
    })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
