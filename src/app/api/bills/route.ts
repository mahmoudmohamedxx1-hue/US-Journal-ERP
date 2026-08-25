import { db } from '@/lib/db'
import { ok, err, getSystemContext } from "@/lib/api"

// GET /api/bills
export async function GET() {
  const ctx = await getSystemContext()
  const bills = await db.bill.findMany({
    where: { organizationId: ctx.organizationId },
    include: { vendor: true },
    orderBy: { dueDate: 'asc' },
  })
  return ok({ bills })
}
