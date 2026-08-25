import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/purchase-orders
export async function GET() {
  const ctx = await getSystemContext()
  const orders = await db.purchaseOrder.findMany({
    where: { organizationId: ctx.organizationId },
    include: { vendor: true, lines: { include: { product: true } } },
    orderBy: { orderDate: 'desc' },
  })
  return ok({ purchaseOrders: orders })
}

// POST /api/purchase-orders
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { poNumber, orderDate, expectedDate, vendorId, notes, lines } = body

    if (!poNumber) return err('PO number is required', 422, undefined, 'VALIDATION_ERROR')
    if (!vendorId) return err('Vendor is required', 422, undefined, 'VALIDATION_ERROR')
    if (!orderDate) return err('Order date is required', 422, undefined, 'VALIDATION_ERROR')
    if (!Array.isArray(lines) || lines.length === 0) return err('At least one line is required', 422, undefined, 'VALIDATION_ERROR')

    const vendor = await db.vendor.findFirst({ where: { id: vendorId, organizationId: ctx.organizationId } })
    if (!vendor) return err('Vendor not found', 404, undefined, 'NOT_FOUND')

    const totalAmount = lines.reduce((s: number, l: { totalPrice?: number; quantity?: number; unitPrice?: number }) => {
      if (l.totalPrice) return s + Math.round(Number(l.totalPrice) * 100)
      if (l.quantity && l.unitPrice) return s + Math.round(Number(l.quantity) * Number(l.unitPrice) * 100)
      return s
    }, 0)

    const po = await db.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.create({
        data: {
          organizationId: ctx.organizationId,
          poNumber,
          orderDate: new Date(orderDate),
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          vendorId,
          totalAmount,
          notes: notes || null,
          status: 'Draft',
        },
      })
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]
        await tx.purchaseOrderLine.create({
          data: {
            purchaseOrderId: order.id,
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

    const fullPo = await db.purchaseOrder.findUniqueOrThrow({
      where: { id: po.id },
      include: { vendor: true, lines: { include: { product: true } } },
    })
    return ok({ purchaseOrder: fullPo }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create purchase order', 500, undefined, 'INTERNAL_ERROR')
  }
}
