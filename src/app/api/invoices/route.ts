import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/invoices — list invoices
export async function GET() {
  const ctx = await getSystemContext()
  const invoices = await db.invoice.findMany({
    where: { organizationId: ctx.organizationId },
    include: { customer: true },
    orderBy: { dueDate: 'asc' },
  })
  return ok({ invoices })
}

// POST /api/invoices — create a new invoice
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { invoiceNumber, customerId, invoiceDate, dueDate, amount, description } = body

    if (!invoiceNumber) return err('Invoice number is required', 422, undefined, 'VALIDATION_ERROR')
    if (!customerId) return err('Customer is required', 422, undefined, 'VALIDATION_ERROR')
    if (!invoiceDate) return err('Invoice date is required', 422, undefined, 'VALIDATION_ERROR')
    if (!dueDate) return err('Due date is required', 422, undefined, 'VALIDATION_ERROR')
    if (!amount || amount <= 0) return err('Amount must be positive', 422, undefined, 'VALIDATION_ERROR')

    // Verify customer exists and belongs to org
    const customer = await db.customer.findFirst({
      where: { id: customerId, organizationId: ctx.organizationId },
    })
    if (!customer) return err('Customer not found', 404, undefined, 'NOT_FOUND')

    const today = new Date()
    const invDate = new Date(invoiceDate)
    const due = new Date(dueDate)
    const overdue = today > due && Number(amount) > 0
    const status = overdue ? 'Overdue' : 'Open'

    const invoice = await db.invoice.create({
      data: {
        organizationId: ctx.organizationId,
        customerId,
        invoiceNumber,
        invoiceDate: invDate,
        dueDate: due,
        amount: Math.round(Number(amount) * 100),
        amountPaid: 0,
        status,
        description: description || null,
      },
      include: { customer: true },
    })
    return ok({ invoice }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create invoice', 500, undefined, 'INTERNAL_ERROR')
  }
}
