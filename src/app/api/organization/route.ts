import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok } from '@/lib/api'

// GET /api/organization
export async function GET() {
  const org = await db.organization.findUniqueOrThrow({ where: { id: DEMO_ORG_ID } })
  return ok({ organization: org })
}
