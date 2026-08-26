import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { autoPostInvoice } from '@/lib/invoice-autopost'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSystemContext()
    const { id } = await params
    const result = await autoPostInvoice(id, { organizationId: ctx.organizationId, userId: ctx.userId })
    return ok({ result, message: `Invoice posted → journal ${result.journalNumber} created` }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
