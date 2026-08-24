import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok } from '@/lib/api'

// GET /api/users
export async function GET() {
  const users = await db.user.findMany({
    where: { organizationId: DEMO_ORG_ID },
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
