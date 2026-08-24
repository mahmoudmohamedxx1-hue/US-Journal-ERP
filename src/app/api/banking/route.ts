import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok } from '@/lib/api'

// GET /api/banking
export async function GET() {
  const accounts = await db.bankAccount.findMany({
    where: { organizationId: DEMO_ORG_ID },
    orderBy: { accountName: 'asc' },
    include: {
      transactions: { orderBy: { date: 'desc' }, take: 20 },
    },
  })

  return ok({ accounts })
}
