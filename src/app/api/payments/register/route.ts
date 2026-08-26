import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext, logAudit } from '@/lib/api'

export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { paymentNumber, paymentType, partyType, partyId, bankAccountId, paymentDate, amount, currency, reference, notes, allocations } = body
    if (!paymentNumber) return err('Payment number is required', 422, undefined, 'VALIDATION_ERROR')
    if (!paymentDate) return err('Payment date is required', 422, undefined, 'VALIDATION_ERROR')
    if (!paymentType || !['RECEIPT', 'PAYMENT'].includes(paymentType)) return err('paymentType must be RECEIPT or PAYMENT', 422, undefined, 'VALIDATION_ERROR')
    if (!partyType || !['CUSTOMER', 'VENDOR'].includes(partyType)) return err('partyType must be CUSTOMER or VENDOR', 422, undefined, 'VALIDATION_ERROR')
    if (!partyId) return err('Party ID is required', 422, undefined, 'VALIDATION_ERROR')
    if (!bankAccountId) return err('Bank account is required', 422, undefined, 'VALIDATION_ERROR')
    if (!amount || amount <= 0) return err('Amount must be positive', 422, undefined, 'VALIDATION_ERROR')

    const bank = await db.bankAccount.findFirst({ where: { id: bankAccountId, organizationId: ctx.organizationId } })
    if (!bank) return err('Bank account not found', 404, undefined, 'NOT_FOUND')

    if (partyType === 'CUSTOMER') {
      const c = await db.customer.findFirst({ where: { id: partyId, organizationId: ctx.organizationId } })
      if (!c) return err('Customer not found', 404, undefined, 'NOT_FOUND')
    } else {
      const v = await db.vendor.findFirst({ where: { id: partyId, organizationId: ctx.organizationId } })
      if (!v) return err('Vendor not found', 404, undefined, 'NOT_FOUND')
    }

    const amountCents = Math.round(Number(amount) * 100)
    const isSale = partyType === 'CUSTOMER'

    // Auto-allocate oldest-first if no allocations provided
    let allocs = allocations
    if (!allocs || !Array.isArray(allocs) || allocs.length === 0) {
      allocs = []
      if (isSale) {
        const openInvoices = await db.invoice.findMany({ where: { organizationId: ctx.organizationId, customerId: partyId, status: { in: ['Open', 'Partially Paid', 'Overdue'] } }, orderBy: { invoiceDate: 'asc' } })
        let remaining = amountCents
        for (const inv of openInvoices) {
          if (remaining <= 0) break
          const outstanding = inv.amount - inv.amountPaid
          if (outstanding <= 0) continue
          const allocAmount = Math.min(remaining, outstanding)
          allocs.push({ invoiceId: inv.id, amount: allocAmount / 100 })
          remaining -= allocAmount
        }
      } else {
        const openBills = await db.bill.findMany({ where: { organizationId: ctx.organizationId, vendorId: partyId, status: { in: ['Open', 'Partially Paid', 'Overdue'] } }, orderBy: { billDate: 'asc' } })
        let remaining = amountCents
        for (const bill of openBills) {
          if (remaining <= 0) break
          const outstanding = bill.amount - bill.amountPaid
          if (outstanding <= 0) continue
          const allocAmount = Math.min(remaining, outstanding)
          allocs.push({ billId: bill.id, amount: allocAmount / 100 })
          remaining -= allocAmount
        }
      }
    }

    const result = await db.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: { organizationId: ctx.organizationId, paymentNumber, paymentDate: new Date(paymentDate), paymentType, partyType, partyId, bankAccountId, amount: amountCents, currency: currency || 'USD', reference: reference || null, notes: notes || null, status: 'Posted' },
      })
      let totalAllocated = 0
      for (const alloc of allocs) {
        const allocCents = Math.round(Number(alloc.amount) * 100)
        if (allocCents <= 0) continue
        await tx.allocation.create({ data: { paymentId: p.id, invoiceId: alloc.invoiceId || null, billId: alloc.billId || null, amount: allocCents } })
        if (alloc.invoiceId) {
          const inv = await tx.invoice.findUnique({ where: { id: alloc.invoiceId } })
          if (inv) {
            const newPaid = inv.amountPaid + allocCents
            await tx.invoice.update({ where: { id: alloc.invoiceId }, data: { amountPaid: newPaid, status: newPaid >= inv.amount ? 'Paid' : 'Partially Paid' } })
          }
        }
        if (alloc.billId) {
          const bill = await tx.bill.findUnique({ where: { id: alloc.billId } })
          if (bill) {
            const newPaid = bill.amountPaid + allocCents
            await tx.bill.update({ where: { id: alloc.billId }, data: { amountPaid: newPaid, status: newPaid >= bill.amount ? 'Paid' : 'Partially Paid' } })
          }
        }
        totalAllocated += allocCents
      }
      if (isSale) {
        await tx.customer.update({ where: { id: partyId }, data: { balance: { decrement: totalAllocated } } })
      } else {
        await tx.vendor.update({ where: { id: partyId }, data: { balance: { decrement: totalAllocated } } })
      }
      const balanceChange = paymentType === 'RECEIPT' ? amountCents : -amountCents
      await tx.bankAccount.update({ where: { id: bankAccountId }, data: { balance: { increment: balanceChange } } })
      await tx.bankTransaction.create({ data: { bankAccountId, date: new Date(paymentDate), amount: amountCents, type: paymentType === 'RECEIPT' ? 'Credit' : 'Debit', description: notes || `${paymentType} ${paymentNumber}`, reference: reference || paymentNumber, reconciled: false } })
      return { payment: p, totalAllocated }
    })

    await logAudit({ action: 'REGISTER_PAYMENT', entityType: 'Payment', entityId: result.payment.id, description: `Registered ${paymentType} ${paymentNumber} for ${amountCents} cents, allocated ${result.totalAllocated} cents to ${allocs.length} ${isSale ? 'invoices' : 'bills'}` })
    return ok({ payment: result.payment, totalAllocated: result.totalAllocated, allocationsCount: allocs.length, unallocatedAmount: amountCents - result.totalAllocated }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}

export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const partyType = url.searchParams.get('partyType') || 'CUSTOMER'
  const partyId = url.searchParams.get('partyId')
  if (!partyId) return err('partyId is required', 422, undefined, 'VALIDATION_ERROR')
  if (partyType === 'CUSTOMER') {
    const invoices = await db.invoice.findMany({ where: { organizationId: ctx.organizationId, customerId: partyId, status: { in: ['Open', 'Partially Paid', 'Overdue'] } }, orderBy: { invoiceDate: 'asc' }, select: { id: true, invoiceNumber: true, invoiceDate: true, dueDate: true, amount: true, amountPaid: true, status: true, currency: true } })
    return ok({ openItems: invoices.map(inv => ({ id: inv.id, number: inv.invoiceNumber, date: inv.invoiceDate, dueDate: inv.dueDate, total: inv.amount, paid: inv.amountPaid, outstanding: inv.amount - inv.amountPaid, status: inv.status, currency: inv.currency, type: 'invoice' as const })), partyType: 'CUSTOMER' })
  } else {
    const bills = await db.bill.findMany({ where: { organizationId: ctx.organizationId, vendorId: partyId, status: { in: ['Open', 'Partially Paid', 'Overdue'] } }, orderBy: { billDate: 'asc' }, select: { id: true, billNumber: true, billDate: true, dueDate: true, amount: true, amountPaid: true, status: true, currency: true } })
    return ok({ openItems: bills.map(bill => ({ id: bill.id, number: bill.billNumber, date: bill.billDate, dueDate: bill.dueDate, total: bill.amount, paid: bill.amountPaid, outstanding: bill.amount - bill.amountPaid, status: bill.status, currency: bill.currency, type: 'bill' as const })), partyType: 'VENDOR' })
  }
}
