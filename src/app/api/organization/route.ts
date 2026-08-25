import { db } from '@/lib/db'
import { ok, err, getSystemContext } from "@/lib/api"

// GET /api/organization
export async function GET() {
  const ctx = await getSystemContext()
  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } })
  return ok({ organization: org })
}
