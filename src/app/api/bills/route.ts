import { db } from '@/lib/db'
import { ok, err } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/bills
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const bills = await db.bill.findMany({
    where: { organizationId: user.organizationId },
    include: { vendor: true },
    orderBy: { dueDate: 'asc' },
  })
  return ok({ bills })
}
