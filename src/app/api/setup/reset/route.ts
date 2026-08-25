import { db } from '@/lib/db'
import { ok, err } from '@/lib/api'

/**
 * POST /api/setup/reset
 *
 * Wipes ALL data from the database — organizations, users, accounts,
 * journals, vendors, customers, etc. — so the Setup Wizard can run
 * again from scratch.
 *
 * This is a destructive operation intended for desktop apps where the
 * user has forgotten their password and wants to start over.
 *
 * For production multi-user deployments, this endpoint should be
 * disabled or protected behind a separate admin token.
 */
export async function POST() {
  try {
    // Delete in dependency order (children first, parents last)
    // This respects foreign key constraints

    // Journal-related
    await db.journalLine.deleteMany()
    await db.journalApproval.deleteMany()
    await db.journalAttachment.deleteMany()
    await db.journal.deleteMany()

    // Sub-ledgers
    await db.bill.deleteMany()
    await db.invoice.deleteMany()
    await db.vendor.deleteMany()
    await db.customer.deleteMany()

    // Banking
    await db.bankTransaction.deleteMany()
    await db.bankAccount.deleteMany()

    // Dimensions
    await db.department.deleteMany()
    await db.location.deleteMany()
    await db.project.deleteMany()
    await db.taxCode.deleteMany()

    // Chart of accounts
    await db.account.deleteMany()

    // Fiscal calendar
    await db.fiscalPeriod.deleteMany()
    await db.fiscalYear.deleteMany()

    // Sessions + audit log + memberships
    await db.session.deleteMany()
    await db.auditLog.deleteMany()
    await db.membership.deleteMany()

    // Users + organization (last — top of hierarchy)
    await db.user.deleteMany()
    await db.organization.deleteMany()

    return ok({
      success: true,
      message: 'Database reset complete. All data deleted.',
    })
  } catch (e) {
    console.error('[setup/reset] Error:', e)
    return err(
      e instanceof Error ? e.message : 'Reset failed',
      500,
      undefined,
      'INTERNAL_ERROR',
    )
  }
}
