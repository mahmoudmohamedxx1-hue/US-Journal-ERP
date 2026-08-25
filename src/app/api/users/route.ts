import { db } from '@/lib/db'
import { ok, err } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/users
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const users = await db.user.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
    },
  })
  return ok({ users })
}
