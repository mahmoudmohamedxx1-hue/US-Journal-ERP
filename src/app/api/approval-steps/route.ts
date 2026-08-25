import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/approval-steps
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const entityType = url.searchParams.get('entityType')

  const where: Record<string, unknown> = { organizationId: ctx.organizationId, active: true }
  if (entityType) where.entityType = entityType

  const steps = await db.approvalStep.findMany({
    where,
    orderBy: [{ entityType: 'asc' }, { stepNumber: 'asc' }],
  })
  return ok({ approvalSteps: steps })
}

// POST /api/approval-steps — create an approval step
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { entityType, stepNumber, approverRole, description } = body

    if (!entityType || !stepNumber || !approverRole) {
      return err('entityType, stepNumber, approverRole are required', 422, undefined, 'VALIDATION_ERROR')
    }

    const step = await db.approvalStep.create({
      data: {
        organizationId: ctx.organizationId,
        entityType,
        stepNumber: Number(stepNumber),
        approverRole,
        description: description || null,
        active: true,
      },
    })
    return ok({ approvalStep: step }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
