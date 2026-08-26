import { ok, getSystemContext } from '@/lib/api'
import { getKpiSummary } from '@/lib/odoo-complete'
export async function GET() {
  const ctx = await getSystemContext()
  const kpis = await getKpiSummary(ctx.organizationId)
  return ok({ kpis })
}
