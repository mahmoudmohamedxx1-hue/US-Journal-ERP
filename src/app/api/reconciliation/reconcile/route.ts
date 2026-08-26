import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { reconcilePayment, getReconciliations, unreconcile } from '@/lib/reconciliation'

// POST /api/reconciliation/reconcile — reconcile a payment against an invoice
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json()
    const result = await reconcilePayment(body.paymentLineId, body.invoiceLineId, body.amount, ctx.organizationId, ctx.userId)
    return ok({ result })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}

// GET /api/reconciliation/reconcile?journalLineId=xxx
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const journalLineId = url.searchParams.get('journalLineId')
  if (!journalLineId) return err('journalLineId is required', 422, undefined, 'VALIDATION_ERROR')
  const result = await getReconciliations(journalLineId)
  return ok({ reconciliations: result })
}

// DELETE /api/reconciliation/reconcile?allocationId=xxx — unreconcile
export async function DELETE(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const allocationId = url.searchParams.get('allocationId')
  if (!allocationId) return err('allocationId is required', 422, undefined, 'VALIDATION_ERROR')
  const result = await unreconcile(allocationId, ctx.organizationId, ctx.userId)
  return ok({ result })
}
