import { ok, getSystemContext } from '@/lib/api'
import { autoPostDueBills } from '@/lib/odoo-complete'
export async function POST() {
  const ctx = await getSystemContext()
  const result = await autoPostDueBills(ctx.organizationId, ctx.userId)
  return ok({ result })
}
