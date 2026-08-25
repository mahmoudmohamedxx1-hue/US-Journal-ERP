import { db } from '@/lib/db'
import { ok, err, getSystemContext } from "@/lib/api"

// GET /api/banking
export async function GET() {
  const ctx = await getSystemContext()
  const accounts = await db.bankAccount.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { accountName: 'asc' },
    include: {
      transactions: { orderBy: { date: 'desc' }, take: 20 },
    },
  })

  return ok({ accounts })
}
