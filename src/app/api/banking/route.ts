import { db } from '@/lib/db'
import { ok, err } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/banking
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const accounts = await db.bankAccount.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { accountName: 'asc' },
    include: {
      transactions: { orderBy: { date: 'desc' }, take: 20 },
    },
  })

  return ok({ accounts })
}
