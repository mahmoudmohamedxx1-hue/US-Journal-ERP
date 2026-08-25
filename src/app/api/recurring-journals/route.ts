import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/recurring-journals
export async function GET() {
  const ctx = await getSystemContext()
  const journals = await db.recurringJournal.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { nextRunDate: 'asc' },
  })
  return ok({ recurringJournals: journals })
}

// POST /api/recurring-journals
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { name, description, frequency, nextRunDate, template } = body

    if (!name) return err('Name is required', 422, undefined, 'VALIDATION_ERROR')
    if (!frequency) return err('Frequency is required', 422, undefined, 'VALIDATION_ERROR')
    if (!nextRunDate) return err('Next run date is required', 422, undefined, 'VALIDATION_ERROR')
    if (!template) return err('Template (journal lines JSON) is required', 422, undefined, 'VALIDATION_ERROR')

    const recurring = await db.recurringJournal.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        description: description || null,
        frequency,
        nextRunDate: new Date(nextRunDate),
        template: typeof template === 'string' ? template : JSON.stringify(template),
        status: 'Active',
      },
    })
    return ok({ recurringJournal: recurring }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create recurring journal', 500, undefined, 'INTERNAL_ERROR')
  }
}
