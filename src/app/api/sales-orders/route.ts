import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/sales-orders
export async function GET() {
  const ctx = await getSystemContext()
  const orders = await db.salesOrder.findMany({
    where: { organizationId: ctx.organizationId },
    include: { customer: true, lines: { include: { product: true } } },
    orderBy: { orderDate: 'desc' },
  })
  return ok({ salesOrders: orders })
}

// POST /api/sales-orders
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { soNumber, orderDate, expectedDate, customerId, notes, lines } = body

    if (!soNumber) return err('SO number is required', 422, undefined, 'VALIDATION_ERROR')
    if (!customerId) return err('Customer is required', 422, undefined, 'VALIDATION_ERROR')
    if (!orderDate) return err('Order date is required', 422, undefined, 'VALIDATION_ERROR')
    if (!Array.isArray(lines) || lines.length === 0) return err('At least one line is required', 422, undefined, 'VALIDATION_ERROR')

    const customer = await db.customer.findFirst({ where: { id: customerId, organizationId: ctx.organizationId } })
    if (!customer) return err('Customer not found', 404, undefined, 'NOT_FOUND')

    const totalAmount = lines.reduce((s: number, l: { totalPrice?: number; quantity?: number; unitPrice?: number }) => {
      if (l.totalPrice) return s + Math.round(Number(l.totalPrice) * 100)
      if (l.quantity && l.unitPrice) return s + Math.round(Number(l.quantity) * Number(l.unitPrice) * 100)
      return s
    }, 0)

    const so = await db.$transaction(async (tx) => {
      const order = await tx.salesOrder.create({
        data: {
          organizationId: ctx.organizationId,
          soNumber,
          orderDate: new Date(orderDate),
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          customerId,
          totalAmount,
          notes: notes || null,
          status: 'Draft',
        },
      })
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]
        await tx.salesOrderLine.create({
          data: {
            salesOrderId: order.id,
            productId: l.productId || null,
            description: l.description || '',
            quantity: Number(l.quantity) || 0,
            unitPrice: Math.round(Number(l.unitPrice) * 100) || 0,
            totalPrice: l.totalPrice ? Math.round(Number(l.totalPrice) * 100) : Math.round(Number(l.quantity) * Number(l.unitPrice) * 100),
          },
        })
      }
      return order
    })

    const fullSo = await db.salesOrder.findUniqueOrThrow({
      where: { id: so.id },
      include: { customer: true, lines: { include: { product: true } } },
    })
    return ok({ salesOrder: fullSo }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create sales order', 500, undefined, 'INTERNAL_ERROR')
  }
}
