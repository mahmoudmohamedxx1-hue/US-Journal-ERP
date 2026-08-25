import { db } from '@/lib/db'
import { ok, err, getSystemContext } from "@/lib/api"

// GET /api/users
export async function GET() {
  const ctx = await getSystemContext()
  const users = await db.user.findMany({
    where: { organizationId: ctx.organizationId },
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
