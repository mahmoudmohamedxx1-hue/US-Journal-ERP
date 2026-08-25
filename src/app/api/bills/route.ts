import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/bills — list bills with lines
export async function GET() {
  const ctx = await getSystemContext()
  const bills = await db.bill.findMany({
    where: { organizationId: ctx.organizationId },
    include: { vendor: true, lines: { include: { product: true, taxCode: true } } },
    orderBy: { dueDate: 'asc' },
  })
  return ok({ bills })
}

// POST /api/bills — create bill with line items
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { billNumber, vendorId, billDate, dueDate, amount, description, lines, currency } = body

    if (!billNumber) return err('Bill number is required', 422, undefined, 'VALIDATION_ERROR')
    if (!vendorId) return err('Vendor is required', 422, undefined, 'VALIDATION_ERROR')
    if (!billDate) return err('Bill date is required', 422, undefined, 'VALIDATION_ERROR')
    if (!dueDate) return err('Due date is required', 422, undefined, 'VALIDATION_ERROR')

    const vendor = await db.vendor.findFirst({ where: { id: vendorId, organizationId: ctx.organizationId } })
    if (!vendor) return err('Vendor not found', 404, undefined, 'NOT_FOUND')

    let totalAmount = 0
    let parsedLines: Array<{ productId?: string; description: string; quantity: number; unitPrice: number; taxCodeId?: string; taxAmount: number; totalPrice: number }> = []

    if (lines && Array.isArray(lines) && lines.length > 0) {
      for (const l of lines) {
        const unitPriceCents = Math.round(Number(l.unitPrice) * 100)
        const qty = Number(l.quantity) || 1
        const lineTotalCents = unitPriceCents * qty
        const taxAmountCents = l.taxAmount ? Math.round(Number(l.taxAmount) * 100) : 0
        const totalPriceCents = lineTotalCents + taxAmountCents
        totalAmount += totalPriceCents
        parsedLines.push({
          productId: l.productId || undefined,
          description: l.description || '',
          quantity: qty,
          unitPrice: unitPriceCents,
          taxCodeId: l.taxCodeId || undefined,
          taxAmount: taxAmountCents,
          totalPrice: totalPriceCents,
        })
      }
    } else {
      totalAmount = amount ? Math.round(Number(amount) * 100) : 0
    }

    const today = new Date()
    const bd = new Date(billDate)
    const due = new Date(dueDate)
    const overdue = today > due && totalAmount > 0
    const status = overdue ? 'Overdue' : 'Open'

    const bill = await db.$transaction(async (tx) => {
      const b = await tx.bill.create({
        data: {
          organizationId: ctx.organizationId,
          vendorId,
          billNumber,
          billDate: bd,
          dueDate: due,
          amount: totalAmount,
          amountPaid: 0,
          status,
          description: description || null,
          currency: currency || 'EGP',
        },
      })
      for (let i = 0; i < parsedLines.length; i++) {
        await tx.billLine.create({
          data: {
            billId: b.id,
            lineNumber: i + 1,
            productId: parsedLines[i].productId || null,
            description: parsedLines[i].description,
            quantity: parsedLines[i].quantity,
            unitPrice: parsedLines[i].unitPrice,
            taxCodeId: parsedLines[i].taxCodeId || null,
            taxAmount: parsedLines[i].taxAmount,
            totalPrice: parsedLines[i].totalPrice,
          },
        })
      }
      return b
    })

    const fullBill = await db.bill.findUniqueOrThrow({
      where: { id: bill.id },
      include: { vendor: true, lines: { include: { product: true, taxCode: true } } },
    })

    return ok({ bill: fullBill }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create bill', 500, undefined, 'INTERNAL_ERROR')
  }
}
