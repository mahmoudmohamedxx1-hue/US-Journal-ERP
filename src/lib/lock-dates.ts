/**
 * US Journal ERP — Lock Date Validator
 *
 * Inspired by Odoo's company.py lock date fields:
 *   - fiscalYearLockDate: Global lock — no entries before this date
 *   - taxLockDate: Tax return lock — no tax entries before this date
 *   - saleLockDate: Sales lock — no sales entries before this date
 *   - purchaseLockDate: Purchase lock — no purchase entries before this date
 *   - hardLockDate: Hard lock — irreversible, no exceptions
 *
 * Usage in API routes:
 *   import { validateLockDates } from '@/lib/lock-dates'
 *   const error = await validateLockDates(orgId, journalDate, source)
 *   if (error) return err(error, 422)
 */

import { db } from '@/lib/db'

export interface LockDateViolation {
  field: string
  lockDate: Date
  journalDate: Date
  message: string
}

/**
 * Validate that a journal date is not before any lock date.
 * Returns null if OK, or an error message if locked.
 */
export async function validateLockDates(
  organizationId: string,
  journalDate: Date,
  source?: string,
): Promise<string | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      fiscalYearLockDate: true,
      taxLockDate: true,
      saleLockDate: true,
      purchaseLockDate: true,
      hardLockDate: true,
    },
  })
  if (!org) return null

  // Hard lock — no exceptions, even for admins
  if (org.hardLockDate && journalDate <= org.hardLockDate) {
    return `Cannot post: hard lock date is ${org.hardLockDate.toISOString().slice(0, 10)}. This lock is irreversible.`
  }

  // Global fiscal year lock
  if (org.fiscalYearLockDate && journalDate <= org.fiscalYearLockDate) {
    return `Cannot post: fiscal year lock date is ${org.fiscalYearLockDate.toISOString().slice(0, 10)}. All entries before this date are locked.`
  }

  // Tax lock — applies if journal has taxes (simplified: check all source types)
  if (org.taxLockDate && journalDate <= org.taxLockDate) {
    return `Cannot post: tax return lock date is ${org.taxLockDate.toISOString().slice(0, 10)}. Entries with taxes before this date are locked.`
  }

  // Sale lock — applies to AR/sales journals
  if (org.saleLockDate && journalDate <= org.saleLockDate) {
    const isSale = source === 'AR' || source === 'Sale' || source === 'Manual'
    if (isSale) {
      return `Cannot post: sales lock date is ${org.saleLockDate.toISOString().slice(0, 10)}. Sales entries before this date are locked.`
    }
  }

  // Purchase lock — applies to AP/purchase journals
  if (org.purchaseLockDate && journalDate <= org.purchaseLockDate) {
    const isPurchase = source === 'AP' || source === 'Purchase'
    if (isPurchase) {
      return `Cannot post: purchase lock date is ${org.purchaseLockDate.toISOString().slice(0, 10)}. Purchase entries before this date are locked.`
    }
  }

  return null
}

/**
 * Get current lock dates for an organization.
 */
export async function getLockDates(organizationId: string) {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      fiscalYearLockDate: true,
      taxLockDate: true,
      saleLockDate: true,
      purchaseLockDate: true,
      hardLockDate: true,
    },
  })
  if (!org) return null

  return {
    fiscalYearLockDate: org.fiscalYearLockDate?.toISOString().slice(0, 10) || null,
    taxLockDate: org.taxLockDate?.toISOString().slice(0, 10) || null,
    saleLockDate: org.saleLockDate?.toISOString().slice(0, 10) || null,
    purchaseLockDate: org.purchaseLockDate?.toISOString().slice(0, 10) || null,
    hardLockDate: org.hardLockDate?.toISOString().slice(0, 10) || null,
  }
}

/**
 * Set lock dates for an organization.
 * hardLockDate cannot be changed once set (irreversible).
 */
export async function setLockDates(
  organizationId: string,
  dates: {
    fiscalYearLockDate?: string | null
    taxLockDate?: string | null
    saleLockDate?: string | null
    purchaseLockDate?: string | null
    hardLockDate?: string | null
  },
) {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { hardLockDate: true },
  })

  // Prevent changing hard lock date once set (Odoo behavior)
  if (org?.hardLockDate && dates.hardLockDate && dates.hardLockDate !== org.hardLockDate.toISOString().slice(0, 10)) {
    throw new Error('Hard lock date cannot be changed once set. This is an irreversible lock.')
  }

  const updateData: Record<string, Date | null> = {}
  if (dates.fiscalYearLockDate !== undefined) {
    updateData.fiscalYearLockDate = dates.fiscalYearLockDate ? new Date(dates.fiscalYearLockDate) : null
  }
  if (dates.taxLockDate !== undefined) {
    updateData.taxLockDate = dates.taxLockDate ? new Date(dates.taxLockDate) : null
  }
  if (dates.saleLockDate !== undefined) {
    updateData.saleLockDate = dates.saleLockDate ? new Date(dates.saleLockDate) : null
  }
  if (dates.purchaseLockDate !== undefined) {
    updateData.purchaseLockDate = dates.purchaseLockDate ? new Date(dates.purchaseLockDate) : null
  }
  if (dates.hardLockDate !== undefined && !org?.hardLockDate) {
    updateData.hardLockDate = dates.hardLockDate ? new Date(dates.hardLockDate) : null
  }

  await db.organization.update({
    where: { id: organizationId },
    data: updateData,
  })

  return getLockDates(organizationId)
}
