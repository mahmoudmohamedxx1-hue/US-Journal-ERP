import { db } from '@/lib/db'
import { ok, err } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/organization
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const org = await db.organization.findUniqueOrThrow({ where: { id: user.organizationId } })
  return ok({ organization: org })
}
