import { ok, getSystemContext } from '@/lib/api'
import { getAccountHierarchy } from '@/lib/odoo-complete'
export async function GET() {
  const ctx = await getSystemContext()
  const tree = await getAccountHierarchy(ctx.organizationId)
  return ok({ tree })
}
