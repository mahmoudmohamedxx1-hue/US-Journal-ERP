import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/reconciliations — list reconciliation sessions
export async function GET() {
  const ctx = await getSystemContext()
  const recs = await db.reconciliation.findMany({
    where: { organizationId: ctx.organizationId },
    include: { bankAccount: true },
    orderBy: { statementDate: 'desc' },
  })
  return ok({ reconciliations: recs })
}

// POST /api/reconciliations — create a reconciliation session
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { bankAccountId, statementDate, startingBalance, endingBalance } = body

    if (!bankAccountId || !statementDate || startingBalance === undefined || endingBalance === undefined) {
      return err('bankAccountId, statementDate, startingBalance, endingBalance are required', 422, undefined, 'VALIDATION_ERROR')
    }

    const bank = await db.bankAccount.findFirst({ where: { id: bankAccountId, organizationId: ctx.organizationId } })
    if (!bank) return err('Bank account not found', 404, undefined, 'NOT_FOUND')

    const rec = await db.reconciliation.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId,
        statementDate: new Date(statementDate),
        startingBalance: Math.round(Number(startingBalance) * 100),
        endingBalance: Math.round(Number(endingBalance) * 100),
        status: 'Open',
      },
      include: { bankAccount: true },
    })
    return ok({ reconciliation: rec }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
