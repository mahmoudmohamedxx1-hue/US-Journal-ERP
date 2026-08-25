import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/invoices — list invoices with lines
export async function GET() {
  const ctx = await getSystemContext()
  const invoices = await db.invoice.findMany({
    where: { organizationId: ctx.organizationId },
    include: { customer: true, lines: { include: { product: true, taxCode: true } } },
    orderBy: { dueDate: 'asc' },
  })
  return ok({ invoices })
}

// POST /api/invoices — create invoice with line items
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { invoiceNumber, customerId, invoiceDate, dueDate, amount, description, lines, currency } = body

    if (!invoiceNumber) return err('Invoice number is required', 422, undefined, 'VALIDATION_ERROR')
    if (!customerId) return err('Customer is required', 422, undefined, 'VALIDATION_ERROR')
    if (!invoiceDate) return err('Invoice date is required', 422, undefined, 'VALIDATION_ERROR')
    if (!dueDate) return err('Due date is required', 422, undefined, 'VALIDATION_ERROR')

    const customer = await db.customer.findFirst({ where: { id: customerId, organizationId: ctx.organizationId } })
    if (!customer) return err('Customer not found', 404, undefined, 'NOT_FOUND')

    // Calculate total from lines if provided, otherwise use amount
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
    const invDate = new Date(invoiceDate)
    const due = new Date(dueDate)
    const overdue = today > due && totalAmount > 0
    const status = overdue ? 'Overdue' : 'Open'

    // Create invoice + lines in transaction
    const invoice = await db.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          organizationId: ctx.organizationId,
          customerId,
          invoiceNumber,
          invoiceDate: invDate,
          dueDate: due,
          amount: totalAmount,
          amountPaid: 0,
          status,
          description: description || null,
          currency: currency || 'EGP',
        },
      })
      for (let i = 0; i < parsedLines.length; i++) {
        await tx.invoiceLine.create({
          data: {
            invoiceId: inv.id,
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
      return inv
    })

    const fullInvoice = await db.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: { customer: true, lines: { include: { product: true, taxCode: true } } },
    })

    return ok({ invoice: fullInvoice }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create invoice', 500, undefined, 'INTERNAL_ERROR')
  }
}
