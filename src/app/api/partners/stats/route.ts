import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { getPartnerStats } from '@/lib/partner'

// GET /api/partners/stats?role=customer&partyId=xxx
// Returns partner statistics including open invoices, overdue count, outstanding balance.
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const role = (url.searchParams.get('role') || 'customer') as 'customer' | 'vendor'
  const partyId = url.searchParams.get('partyId')
  if (!partyId) return err('partyId is required', 422, undefined, 'VALIDATION_ERROR')

  const stats = await getPartnerStats(ctx.organizationId, partyId, role)
  if (!stats) return err('Partner not found', 404, undefined, 'NOT_FOUND')

  return ok({ stats })
}
