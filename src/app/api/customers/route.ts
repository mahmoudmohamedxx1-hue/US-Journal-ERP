import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok } from '@/lib/api'

// GET /api/customers
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const includeInvoices = url.searchParams.get('withInvoices') === '1'
  const activeOnly = url.searchParams.get('active') !== '0'

  const where: Record<string, unknown> = { organizationId: DEMO_ORG_ID }
  if (activeOnly) where.active = true

  const customers = await db.customer.findMany({
    where,
    orderBy: { name: 'asc' },
    include: includeInvoices ? { invoices: true } : false,
  })

  const today = new Date('2026-08-24')
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 }
  for (const c of customers) {
    if (includeInvoices && c.invoices) {
      for (const inv of c.invoices) {
        if (inv.amountPaid >= inv.amount) continue
        const remaining = inv.amount - inv.amountPaid
        const days = Math.floor((today.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        if (days < 0) buckets.current += remaining
        else if (days <= 30) buckets.d30 += remaining
        else if (days <= 60) buckets.d60 += remaining
        else if (days <= 90) buckets.d90 += remaining
        else buckets.d90plus += remaining
      }
    }
  }

  return ok({ customers, aging: buckets })
}
