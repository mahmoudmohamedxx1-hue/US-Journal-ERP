import { NextRequest } from 'next/server'
import { ok, getSystemContext } from '@/lib/api'
import { getCustomerPortalInvoices } from '@/lib/odoo-complete'
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSystemContext()
  const { id } = await params
  const invoices = await getCustomerPortalInvoices(ctx.organizationId, id)
  return ok({ invoices })
}
