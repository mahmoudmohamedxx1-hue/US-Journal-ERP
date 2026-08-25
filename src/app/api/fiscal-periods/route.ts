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
