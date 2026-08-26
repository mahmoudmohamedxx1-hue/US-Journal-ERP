import { ok, getSystemContext } from '@/lib/api'
import { getAccountingConfig } from '@/lib/odoo-complete'
export async function GET() {
  const ctx = await getSystemContext()
  const config = await getAccountingConfig(ctx.organizationId)
  return ok({ config })
}
