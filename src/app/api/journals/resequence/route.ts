import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { resequenceJournals } from '@/lib/odoo-complete'
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json()
    const result = await resequenceJournals(ctx.organizationId, ctx.userId, body)
    return ok({ result })
  } catch (e) { return err(e instanceof Error ? e.message : 'Failed', 500) }
}
