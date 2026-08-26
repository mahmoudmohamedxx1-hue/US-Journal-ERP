import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext, logAudit } from '@/lib/api'

// POST /api/purchase-orders/[id]/receive — receive goods (update inventory + PO line receivedQty)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSystemContext()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { lines } = body // [{ lineId, receivedQty }]

    if (!lines || !Array.isArray(lines)) return err('lines array is required', 422, undefined, 'VALIDATION_ERROR')

    const po = await db.purchaseOrder.findFirst({ where: { id, organizationId: ctx.organizationId }, include: { lines: true } })
    if (!po) return err('Purchase order not found', 404, undefined, 'NOT_FOUND')
    if (po.status === 'Received') return err('PO already fully received', 422, undefined, 'ALREADY_RECEIVED')

    const result = await db.$transaction(async (tx) => {
      // Update each PO line's receivedQty
      for (const item of lines) {
        const poLine = po.lines.find((l) => l.id === item.lineId)
        if (!poLine) continue
        const newReceivedQty = poLine.receivedQty + Number(item.receivedQty)
        await tx.purchaseOrderLine.update({
          where: { id: item.lineId },
          data: { receivedQty: newReceivedQty },
        })

        // Update product stock if linked
        if (poLine.productId) {
          await tx.product.update({
            where: { id: poLine.productId },
            data: { stockQuantity: { increment: Number(item.receivedQty) } },
          })

          // Create inventory move record
          await tx.inventoryMove.create({
            data: {
              organizationId: ctx.organizationId,
              productId: poLine.productId,
              quantity: Number(item.receivedQty),
              moveType: 'PURCHASE',
              reference: po.poNumber,
              notes: `Received via PO ${po.poNumber}`,
            },
          })
        }
      }

      // Check if all lines are fully received
      const allReceived = po.lines.every((l) => {
        const item = lines.find((i: { lineId: string }) => i.lineId === l.id)
        return l.receivedQty + Number(item?.receivedQty || 0) >= l.quantity
      })

      if (allReceived) {
        await tx.purchaseOrder.update({ where: { id }, data: { status: 'Received' } })
      }

      return { allReceived }
    })

    await logAudit({
      action: 'RECEIVE_PURCHASE_ORDER',
      entityType: 'PurchaseOrder',
      entityId: id,
      description: `Received goods for PO ${po.poNumber} — ${lines.length} line(s), fully received: ${result.allReceived}`,
    })

    return ok({ success: true, fullyReceived: result.allReceived })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to receive goods', 500, undefined, 'INTERNAL_ERROR')
  }
}
