import { db } from '@/lib/db'
import { ok, err } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/invoices
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const invoices = await db.invoice.findMany({
    where: { organizationId: user.organizationId },
    include: { customer: true },
    orderBy: { dueDate: 'asc' },
  })
  return ok({ invoices })
}
