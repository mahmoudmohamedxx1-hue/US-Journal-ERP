import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/banking
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const accounts = await db.bankAccount.findMany({
    where: { organizationId: DEMO_ORG_ID },
    orderBy: { accountName: 'asc' },
    include: {
      transactions: { orderBy: { date: 'desc' }, take: 20 },
    },
  })

  return ok({ accounts })
}
