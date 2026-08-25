import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/customers — list customers with optional aging + pagination
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const includeInvoices = url.searchParams.get('withInvoices') === '1'
  const activeOnly = url.searchParams.get('active') !== '0'
  const search = url.searchParams.get('q')
  const page = parseInt(url.searchParams.get('page') || '1')
  const pageSize = parseInt(url.searchParams.get('pageSize') || '50')

  const where: Record<string, unknown> = { organizationId: ctx.organizationId }
  if (activeOnly) where.active = true
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { customerNumber: { contains: search } },
      { email: { contains: search } },
      { contactName: { contains: search } },
    ]
  }

  const [total, customers] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      include: includeInvoices ? { invoices: true } : false,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  const today = new Date()
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

  return ok({
    customers,
    aging: buckets,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}

// POST /api/customers — create a new customer
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { customerNumber, name, contactName, email, phone, address, taxId, paymentTerms, currency, creditLimit } = body

    if (!name) return err('Customer name is required', 422, undefined, 'VALIDATION_ERROR')
    if (!customerNumber) return err('Customer number is required', 422, undefined, 'VALIDATION_ERROR')

    const existing = await db.customer.findFirst({
      where: { organizationId: ctx.organizationId, customerNumber },
    })
    if (existing) return err(`Customer number ${customerNumber} already exists`, 409, undefined, 'DUPLICATE')

    const customer = await db.customer.create({
      data: {
        organizationId: ctx.organizationId,
        customerNumber,
        name,
        contactName: contactName || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        taxId: taxId || null,
        paymentTerms: paymentTerms || null,
        currency: currency || 'EGP',
        balance: 0,
        creditLimit: creditLimit ? Math.round(Number(creditLimit) * 100) : null,
        active: true,
      },
    })
    return ok({ customer }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create customer', 500, undefined, 'INTERNAL_ERROR')
  }
}
