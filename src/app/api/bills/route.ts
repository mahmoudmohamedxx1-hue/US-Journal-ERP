import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok } from '@/lib/api'

// GET /api/bills
export async function GET() {
  const bills = await db.bill.findMany({
    where: { organizationId: DEMO_ORG_ID },
    include: { vendor: true },
    orderBy: { dueDate: 'asc' },
  })
  return ok({ bills })
}
