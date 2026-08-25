import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/vendors — list vendors with optional aging
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const includeBills = url.searchParams.get('withBills') === '1'
  const activeOnly = url.searchParams.get('active') !== '0'
  const search = url.searchParams.get('q')
  const page = parseInt(url.searchParams.get('page') || '1')
  const pageSize = parseInt(url.searchParams.get('pageSize') || '50')

  const where: Record<string, unknown> = { organizationId: ctx.organizationId }
  if (activeOnly) where.active = true
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { vendorNumber: { contains: search } },
      { email: { contains: search } },
      { contactName: { contains: search } },
    ]
  }

  const [total, vendors] = await Promise.all([
    db.vendor.count({ where }),
    db.vendor.findMany({
      where,
      orderBy: { name: 'asc' },
      include: includeBills ? { bills: true } : false,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  // Aging buckets
  const today = new Date()
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 }
  for (const v of vendors) {
    if (includeBills && v.bills) {
      for (const b of v.bills) {
        if (b.amountPaid >= b.amount) continue
        const remaining = b.amount - b.amountPaid
        const days = Math.floor((today.getTime() - b.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        if (days < 0) buckets.current += remaining
        else if (days <= 30) buckets.d30 += remaining
        else if (days <= 60) buckets.d60 += remaining
        else if (days <= 90) buckets.d90 += remaining
        else buckets.d90plus += remaining
      }
    }
  }

  return ok({
    vendors,
    aging: buckets,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}

// POST /api/vendors — create a new vendor
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { vendorNumber, name, contactName, email, phone, address, taxId, paymentTerms, currency } = body

    if (!name) return err('Vendor name is required', 422, undefined, 'VALIDATION_ERROR')
    if (!vendorNumber) return err('Vendor number is required', 422, undefined, 'VALIDATION_ERROR')

    // Check for duplicate vendor number
    const existing = await db.vendor.findFirst({
      where: { organizationId: ctx.organizationId, vendorNumber },
    })
    if (existing) return err(`Vendor number ${vendorNumber} already exists`, 409, undefined, 'DUPLICATE')

    const vendor = await db.vendor.create({
      data: {
        organizationId: ctx.organizationId,
        vendorNumber,
        name,
        contactName: contactName || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        taxId: taxId || null,
        paymentTerms: paymentTerms || null,
        currency: currency || 'USD',
        balance: 0,
        active: true,
      },
    })
    return ok({ vendor }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create vendor', 500, undefined, 'INTERNAL_ERROR')
  }
}
