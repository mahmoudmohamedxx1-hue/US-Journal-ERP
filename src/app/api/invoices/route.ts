import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok } from '@/lib/api'

// GET /api/invoices
export async function GET() {
  const invoices = await db.invoice.findMany({
    where: { organizationId: DEMO_ORG_ID },
    include: { customer: true },
    orderBy: { dueDate: 'asc' },
  })
  return ok({ invoices })
}
