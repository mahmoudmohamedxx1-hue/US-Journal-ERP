import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext, logAudit } from '@/lib/api'

// GET /api/payments — list payments
export async function GET() {
  const ctx = await getSystemContext()
  const payments = await db.payment.findMany({
    where: { organizationId: ctx.organizationId },
    include: { bankAccount: true, allocations: { include: { invoice: true, bill: true } } },
    orderBy: { paymentDate: 'desc' },
  })
  return ok({ payments })
}

// POST /api/payments — create a payment (receipt from customer or payment to vendor)
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { paymentNumber, paymentDate, paymentType, partyType, partyId, bankAccountId, amount, currency, reference, notes, allocations } = body

    if (!paymentNumber) return err('Payment number is required', 422, undefined, 'VALIDATION_ERROR')
    if (!paymentDate) return err('Payment date is required', 422, undefined, 'VALIDATION_ERROR')
    if (!paymentType || !['RECEIPT', 'PAYMENT'].includes(paymentType)) return err('paymentType must be RECEIPT or PAYMENT', 422, undefined, 'VALIDATION_ERROR')
    if (!partyType || !['CUSTOMER', 'VENDOR'].includes(partyType)) return err('partyType must be CUSTOMER or VENDOR', 422, undefined, 'VALIDATION_ERROR')
    if (!partyId) return err('Party ID is required', 422, undefined, 'VALIDATION_ERROR')
    if (!bankAccountId) return err('Bank account is required', 422, undefined, 'VALIDATION_ERROR')
    if (!amount || amount <= 0) return err('Amount must be positive', 422, undefined, 'VALIDATION_ERROR')

    // Verify bank account
    const bank = await db.bankAccount.findFirst({ where: { id: bankAccountId, organizationId: ctx.organizationId } })
    if (!bank) return err('Bank account not found', 404, undefined, 'NOT_FOUND')

    // Verify party exists
    if (partyType === 'CUSTOMER') {
      const customer = await db.customer.findFirst({ where: { id: partyId, organizationId: ctx.organizationId } })
      if (!customer) return err('Customer not found', 404, undefined, 'NOT_FOUND')
    } else {
      const vendor = await db.vendor.findFirst({ where: { id: partyId, organizationId: ctx.organizationId } })
      if (!vendor) return err('Vendor not found', 404, undefined, 'NOT_FOUND')
    }

    const amountCents = Math.round(Number(amount) * 100)

    // Create payment + allocations in a transaction
    const payment = await db.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          organizationId: ctx.organizationId,
          paymentNumber,
          paymentDate: new Date(paymentDate),
          paymentType,
          partyType,
          partyId,
          bankAccountId,
          amount: amountCents,
          currency: currency || 'EGP',
          reference: reference || null,
          notes: notes || null,
          status: 'Posted',
        },
      })

      // Create allocations if provided
      if (allocations && Array.isArray(allocations)) {
        for (const alloc of allocations) {
          await tx.allocation.create({
            data: {
              paymentId: p.id,
              invoiceId: alloc.invoiceId || null,
              billId: alloc.billId || null,
              amount: Math.round(Number(alloc.amount) * 100),
            },
          })

          // Update invoice/bill amountPaid
          if (alloc.invoiceId) {
            const inv = await tx.invoice.findUnique({ where: { id: alloc.invoiceId } })
            if (inv) {
              const newPaid = inv.amountPaid + Math.round(Number(alloc.amount) * 100)
              await tx.invoice.update({
                where: { id: alloc.invoiceId },
                data: {
                  amountPaid: newPaid,
                  status: newPaid >= inv.amount ? 'Paid' : 'Partially Paid',
                },
              })
            }
          }
          if (alloc.billId) {
            const bill = await tx.bill.findUnique({ where: { id: alloc.billId } })
            if (bill) {
              const newPaid = bill.amountPaid + Math.round(Number(alloc.amount) * 100)
              await tx.bill.update({
                where: { id: alloc.billId },
                data: {
                  amountPaid: newPaid,
                  status: newPaid >= bill.amount ? 'Paid' : 'Partially Paid',
                },
              })
            }
          }
        }
      }

      // Update bank account balance
      const balanceChange = paymentType === 'RECEIPT' ? amountCents : -amountCents
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { balance: { increment: balanceChange } },
      })

      return p
    })

    await logAudit({
      action: 'CREATE_PAYMENT',
      entityType: 'Payment',
      entityId: payment.id,
      description: `Created ${paymentType} ${paymentNumber} for ${amountCents} cents`,
    })

    return ok({ payment }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create payment', 500, undefined, 'INTERNAL_ERROR')
  }
}
