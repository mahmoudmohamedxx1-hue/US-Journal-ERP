import { ok, getSystemContext } from '@/lib/api'
import { getOnboardingProgress } from '@/lib/odoo-complete'
export async function GET() {
  const ctx = await getSystemContext()
  const progress = await getOnboardingProgress(ctx.organizationId)
  return ok({ progress })
}
