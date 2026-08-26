import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { createAccrualEntry } from '@/lib/accrual'

// POST /api/accrual — create accrual or reclassification entry
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json()
    const result = await createAccrualEntry({
      ...body,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    })
    return ok({ result }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
