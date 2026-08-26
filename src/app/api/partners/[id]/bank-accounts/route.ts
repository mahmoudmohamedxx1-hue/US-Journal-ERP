import { NextRequest } from 'next/server'
import { ok, getSystemContext } from '@/lib/api'
import { getPartnerBankAccounts } from '@/lib/odoo-complete'
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSystemContext()
  const { id } = await params
  const url = new URL(req.url)
  const partnerType = (url.searchParams.get('type') || 'vendor') as 'customer' | 'vendor'
  const accounts = await getPartnerBankAccounts(ctx.organizationId, id, partnerType)
  return ok({ bankAccounts: accounts })
}
