import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/organization
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const org = await db.organization.findUniqueOrThrow({ where: { id: DEMO_ORG_ID } })
  return ok({ organization: org })
}
