import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/bills — list bills
export async function GET() {
  const ctx = await getSystemContext()
  const bills = await db.bill.findMany({
    where: { organizationId: ctx.organizationId },
    include: { vendor: true },
    orderBy: { dueDate: 'asc' },
  })
  return ok({ bills })
}

// POST /api/bills — create a new bill
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { billNumber, vendorId, billDate, dueDate, amount, description } = body

    if (!billNumber) return err('Bill number is required', 422, undefined, 'VALIDATION_ERROR')
    if (!vendorId) return err('Vendor is required', 422, undefined, 'VALIDATION_ERROR')
    if (!billDate) return err('Bill date is required', 422, undefined, 'VALIDATION_ERROR')
    if (!dueDate) return err('Due date is required', 422, undefined, 'VALIDATION_ERROR')
    if (!amount || amount <= 0) return err('Amount must be positive', 422, undefined, 'VALIDATION_ERROR')

    // Verify vendor exists
    const vendor = await db.vendor.findFirst({
      where: { id: vendorId, organizationId: ctx.organizationId },
    })
    if (!vendor) return err('Vendor not found', 404, undefined, 'NOT_FOUND')

    const today = new Date()
    const bd = new Date(billDate)
    const due = new Date(dueDate)
    const overdue = today > due && Number(amount) > 0
    const status = overdue ? 'Overdue' : 'Open'

    const bill = await db.bill.create({
      data: {
        organizationId: ctx.organizationId,
        vendorId,
        billNumber,
        billDate: bd,
        dueDate: due,
        amount: Math.round(Number(amount) * 100),
        amountPaid: 0,
        status,
        description: description || null,
      },
      include: { vendor: true },
    })
    return ok({ bill }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create bill', 500, undefined, 'INTERNAL_ERROR')
  }
}
