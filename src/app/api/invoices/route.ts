import { db } from '@/lib/db'
import { ok, err, getSystemContext } from "@/lib/api"

// GET /api/invoices
export async function GET() {
  const ctx = await getSystemContext()
  const invoices = await db.invoice.findMany({
    where: { organizationId: ctx.organizationId },
    include: { customer: true },
    orderBy: { dueDate: 'asc' },
  })
  return ok({ invoices })
}
