import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext, logAudit } from '@/lib/api'

// GET /api/fiscal-periods — list fiscal years with periods
export async function GET() {
  const ctx = await getSystemContext()
  const years = await db.fiscalYear.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { startDate: 'desc' },
    include: { periods: { orderBy: { periodNumber: 'asc' } } },
  })
  return ok({ fiscalYears: years })
}

// POST /api/fiscal-periods — create a new fiscal year with 12 monthly periods
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { name, startDate, endDate } = body

    if (!name) return err('Fiscal year name is required', 422, undefined, 'VALIDATION_ERROR')
    if (!startDate) return err('Start date is required', 422, undefined, 'VALIDATION_ERROR')
    if (!endDate) return err('End date is required', 422, undefined, 'VALIDATION_ERROR')

    const sd = new Date(startDate)
    const ed = new Date(endDate)

    if (sd >= ed) return err('Start date must be before end date', 422, undefined, 'VALIDATION_ERROR')

    // Create fiscal year + auto-generate 12 monthly periods
    const fy = await db.fiscalYear.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        startDate: sd,
        endDate: ed,
        status: 'Open',
      },
    })

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December']

    // Generate periods — first day of each month to last day
    const periods = []
    let current = new Date(sd.getFullYear(), sd.getMonth(), 1)
    let periodNum = 1
    while (current <= ed) {
      const periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59)
      periods.push({
        fiscalYearId: fy.id,
        name: `${monthNames[current.getMonth()]} ${current.getFullYear()}`,
        periodNumber: periodNum++,
        startDate: new Date(current),
        endDate: periodEnd,
        status: 'Open',
      })
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
    }

    await db.fiscalPeriod.createMany({ data: periods })

    await logAudit({
      action: 'CREATE_FISCAL_YEAR',
      entityType: 'FiscalYear',
      entityId: fy.id,
      description: `Created fiscal year ${name} with ${periods.length} periods`,
    })

    const fullFy = await db.fiscalYear.findUniqueOrThrow({
      where: { id: fy.id },
      include: { periods: { orderBy: { periodNumber: 'asc' } } },
    })

    return ok({ fiscalYear: fullFy }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create fiscal year', 500, undefined, 'INTERNAL_ERROR')
  }
}

// PATCH /api/fiscal-periods — close or reopen a specific period
// Only Manager + Administrator roles can close/reopen periods
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getSystemContext()

    // RBAC: only Manager + Administrator can close/reopen periods
    if (ctx.userRole !== 'Manager' && ctx.userRole !== 'Administrator') {
      return err('Forbidden — only Managers can close/reopen periods', 403, { userRole: ctx.userRole }, 'FORBIDDEN')
    }

    const body = await req.json().catch(() => ({}))
    const { periodId, action } = body

    if (!periodId || !['close', 'reopen'].includes(action)) {
      return err('periodId and action (close|reopen) are required', 422, undefined, 'VALIDATION_ERROR')
    }

    const period = await db.fiscalPeriod.findFirst({ where: { id: periodId } })
    if (!period) return err('Period not found', 404, undefined, 'NOT_FOUND')

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
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to update period', 500, undefined, 'INTERNAL_ERROR')
  }
}
