import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext, logAudit } from '@/lib/api'

// POST /api/sales-orders/[id]/ship — ship goods (update inventory + SO line shippedQty)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSystemContext()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { lines } = body

    if (!lines || !Array.isArray(lines)) return err('lines array is required', 422, undefined, 'VALIDATION_ERROR')

    const so = await db.salesOrder.findFirst({ where: { id, organizationId: ctx.organizationId }, include: { lines: true } })
    if (!so) return err('Sales order not found', 404, undefined, 'NOT_FOUND')
    if (so.status === 'Shipped' || so.status === 'Delivered') return err('SO already shipped', 422, undefined, 'ALREADY_SHIPPED')

    const result = await db.$transaction(async (tx) => {
      for (const item of lines) {
        const soLine = so.lines.find((l) => l.id === item.lineId)
        if (!soLine) continue
        const newShippedQty = soLine.shippedQty + Number(item.shippedQty)
        await tx.salesOrderLine.update({
          where: { id: item.lineId },
          data: { shippedQty: newShippedQty },
        })

        // Reduce product stock
        if (soLine.productId) {
          await tx.product.update({
            where: { id: soLine.productId },
            data: { stockQuantity: { decrement: Number(item.shippedQty) } },
          })
          await tx.inventoryMove.create({
            data: {
              organizationId: ctx.organizationId,
              productId: soLine.productId,
              quantity: -Number(item.shippedQty),
              moveType: 'SALE',
              reference: so.soNumber,
              notes: `Shipped via SO ${so.soNumber}`,
            },
          })
        }
      }

      const allShipped = so.lines.every((l) => {
        const item = lines.find((i: { lineId: string }) => i.lineId === l.id)
        return l.shippedQty + Number(item?.shippedQty || 0) >= l.quantity
      })

      if (allShipped) {
        await tx.salesOrder.update({ where: { id }, data: { status: 'Shipped' } })
      }

      return { allShipped }
    })

    await logAudit({
      action: 'SHIP_SALES_ORDER',
      entityType: 'SalesOrder',
      entityId: id,
      description: `Shipped goods for SO ${so.soNumber} — ${lines.length} line(s), fully shipped: ${result.allShipped}`,
    })

    return ok({ success: true, fullyShipped: result.allShipped })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to ship goods', 500, undefined, 'INTERNAL_ERROR')
  }
}
