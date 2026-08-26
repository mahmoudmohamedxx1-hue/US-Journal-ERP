import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { createCreditNote } from '@/lib/odoo-complete'
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json()
    const result = await createCreditNote({ ...body, organizationId: ctx.organizationId, userId: ctx.userId })
    return ok({ result }, 201)
  } catch (e) { return err(e instanceof Error ? e.message : 'Failed', 500) }
}
