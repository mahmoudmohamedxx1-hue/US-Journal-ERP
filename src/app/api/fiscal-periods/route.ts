import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, logAudit } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/fiscal-periods
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const years = await db.fiscalYear.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { startDate: 'desc' },
    include: { periods: { orderBy: { periodNumber: 'asc' } } },
  })
  return ok({ fiscalYears: years })
}

// PATCH /api/fiscal-periods — close or reopen a period
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const body = await req.json().catch(() => ({}))
  const { periodId, action } = body
  if (!periodId || !['close', 'reopen'].includes(action)) {
    return err('periodId and action (close|reopen) are required', 422)
  }
  const period = await db.fiscalPeriod.findFirst({ where: { id: periodId } })
  if (!period) return err('Period not found', 404)

  const newStatus = action === 'close' ? 'Closed' : 'Open'
  await db.fiscalPeriod.update({
    where: { id: periodId },
    data: {
      status: newStatus,
      closedAt: action === 'close' ? new Date() : null,
    },
  })
  await logAudit({
    action: action === 'close' ? 'CLOSE_PERIOD' : 'REOPEN_PERIOD',
    entityType: 'FiscalPeriod',
    entityId: periodId,
    description: `${action === 'close' ? 'Closed' : 'Reopened'} fiscal period ${period.name}`,
  })
  return ok({ success: true, status: newStatus })
}
