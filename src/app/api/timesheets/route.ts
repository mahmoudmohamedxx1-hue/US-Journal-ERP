import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/timesheets
export async function GET() {
  const ctx = await getSystemContext()
  const timesheets = await db.timesheet.findMany({
    where: { organizationId: ctx.organizationId },
    include: { project: true },
    orderBy: { date: 'desc' },
  })
  return ok({ timesheets })
}

// POST /api/timesheets
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { employeeName, projectId, date, hours, description, billableRate } = body

    if (!employeeName || !date || !hours) {
      return err('employeeName, date, hours are required', 422, undefined, 'VALIDATION_ERROR')
    }

    const timesheet = await db.timesheet.create({
      data: {
        organizationId: ctx.organizationId,
        employeeName,
        projectId: projectId || null,
        date: new Date(date),
        hours: Math.round(Number(hours) * 100), // store as basis points (100 = 1 hour)
        description: description || null,
        billableRate: billableRate ? Math.round(Number(billableRate) * 100) : 0,
        status: 'Draft',
      },
      include: { project: true },
    })
    return ok({ timesheet }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
