import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/invoices
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const invoices = await db.invoice.findMany({
    where: { organizationId: DEMO_ORG_ID },
    include: { customer: true },
    orderBy: { dueDate: 'asc' },
  })
  return ok({ invoices })
}
