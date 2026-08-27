import { NextRequest } from 'next/server'
import { ok, getSystemContext } from '@/lib/api'
import { validateMovesWithConfirmation } from '@/lib/odoo-complete'
export async function POST(req: NextRequest) {
  const ctx = await getSystemContext()
  const body = await req.json()
  const result = await validateMovesWithConfirmation(body.journalIds || [], ctx.organizationId)
  return ok({ result })
}
