import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/backup — returns database stats (for health check)
export async function GET() {
  const ctx = await getSystemContext()
  const [accounts, journals, vendors, customers, products, invoices, bills, payments] = await Promise.all([
    db.account.count({ where: { organizationId: ctx.organizationId } }),
    db.journal.count({ where: { organizationId: ctx.organizationId } }),
    db.vendor.count({ where: { organizationId: ctx.organizationId } }),
    db.customer.count({ where: { organizationId: ctx.organizationId } }),
    db.product.count({ where: { organizationId: ctx.organizationId } }),
    db.invoice.count({ where: { organizationId: ctx.organizationId } }),
    db.bill.count({ where: { organizationId: ctx.organizationId } }),
    db.payment.count({ where: { organizationId: ctx.organizationId } }),
  ])
  return ok({
    stats: { accounts, journals, vendors, customers, products, invoices, bills, payments },
    timestamp: new Date().toISOString(),
  })
}

// POST /api/backup — reset all data (destructive)
export async function POST() {
  try {
    // Delete in dependency order
    await db.allocation.deleteMany()
    await db.payment.deleteMany()
    await db.invoiceLine.deleteMany()
    await db.billLine.deleteMany()
    await db.journalLine.deleteMany()
    await db.journalApproval.deleteMany()
    await db.journal.deleteMany()
    await db.invoice.deleteMany()
    await db.bill.deleteMany()
    await db.vendor.deleteMany()
    await db.customer.deleteMany()
    await db.bankTransaction.deleteMany()
    await db.bankAccount.deleteMany()
    await db.reconciliation.deleteMany()
    await db.department.deleteMany()
    await db.location.deleteMany()
    await db.project.deleteMany()
    await db.taxCode.deleteMany()
    await db.account.deleteMany()
    await db.fiscalPeriod.deleteMany()
    await db.fiscalYear.deleteMany()
    await db.exchangeRate.deleteMany()
    await db.recurringJournal.deleteMany()
    await db.budget.deleteMany()
    await db.purchaseOrderLine.deleteMany()
    await db.purchaseOrder.deleteMany()
    await db.salesOrderLine.deleteMany()
    await db.salesOrder.deleteMany()
    await db.inventoryMove.deleteMany()
    await db.warehouse.deleteMany()
    await db.product.deleteMany()
    await db.document.deleteMany()
    await db.customFieldValue.deleteMany()
    await db.customField.deleteMany()
    await db.session.deleteMany()
    await db.auditLog.deleteMany()
    await db.membership.deleteMany()
    await db.user.deleteMany()
    await db.organization.deleteMany()

    return ok({ success: true, message: 'All data deleted successfully' })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Reset failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
