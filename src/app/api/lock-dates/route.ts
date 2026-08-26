import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { getLockDates, setLockDates } from '@/lib/lock-dates'

// GET /api/lock-dates — returns all lock dates for the org
export async function GET() {
  const ctx = await getSystemContext()
  const dates = await getLockDates(ctx.organizationId)
  return ok({ lockDates: dates })
}

// PUT /api/lock-dates — set lock dates
export async function PUT(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json()
    const result = await setLockDates(ctx.organizationId, body)
    return ok({ lockDates: result })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
