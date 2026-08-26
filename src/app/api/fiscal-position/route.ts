import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { getFiscalPosition } from '@/lib/fiscal-position'

// GET /api/fiscal-position?country=US
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const country = url.searchParams.get('country') || undefined
  const fp = await getFiscalPosition(ctx.organizationId, country)
  return ok({ fiscalPosition: fp })
}
