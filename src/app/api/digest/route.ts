import { NextRequest } from 'next/server'
import { ok, getSystemContext } from '@/lib/api'
import { generateDigest } from '@/lib/odoo-complete'
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const period = (url.searchParams.get('period') || 'daily') as 'daily' | 'weekly' | 'monthly'
  const digest = await generateDigest(ctx.organizationId, period)
  return ok({ digest })
}
