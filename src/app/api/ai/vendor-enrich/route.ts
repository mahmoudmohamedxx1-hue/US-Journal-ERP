import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { enrichVendor } from '@/lib/ai/glm'

// POST /api/ai/vendor-enrich
// Body: { vendorName: string }
// Returns: VendorEnrichment
export async function POST(req: NextRequest) {
  try {
    await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const vendorName = String(body.vendorName || '').trim()
    if (!vendorName) return err('vendorName is required', 422)
    if (vendorName.length > 200) return err('vendorName too long', 422)

    const result = await enrichVendor(vendorName)
    return ok({ ai: result, enrichment: result.data || null }, 200)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500)
  }
}
