/**
 * US Journal ERP — Recurring Entries Engine
 *
 * Inspired by Odoo's _apply_delta_recurring_entries and _copy_recurring_entries.
 *
 * Odoo supports recurring journal entries:
 *   - Monthly: advance date by 1 month
 *   - Quarterly: advance by 3 months
 *   - Yearly: advance by 12 months
 *
 * When a recurring entry is posted, Odoo automatically creates the next
 * entry in the sequence with the date advanced by the period delta.
 */

import { db } from '@/lib/db'
import { logAudit } from '@/lib/api'

export type RecurrencePeriod = 'monthly' | 'quarterly' | 'yearly'

const PERIOD_MONTHS: Record<RecurrencePeriod, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
}

/**
 * Advance a date by the recurrence period.
 * Maintains the original day of month when possible (Odoo's _apply_delta_recurring_entries).
 *
 * E.g., Jan 31 → monthly → Feb 28 (can't be Feb 31)
 *       Jan 31 → monthly → Mar 31 (back to 31st)
 */
export function advanceDate(date: Date, originDate: Date, period: RecurrencePeriod): Date {
  const deltaMonths = PERIOD_MONTHS[period]
  const prevMonths = (date.getFullYear() - originDate.getFullYear()) * 12 + date.getMonth() - originDate.getMonth()
  const totalMonths = deltaMonths + prevMonths

  const newDate = new Date(originDate)
  newDate.setMonth(originDate.getMonth() + totalMonths)

  // Try to maintain the original day of month
  const originalDay = originDate.getDate()
  const lastDayOfNewMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate()
  newDate.setDate(Math.min(originalDay, lastDayOfNewMonth))

  return newDate
}

/**
 * Execute a recurring journal — creates the next entry in the sequence.
 *
 * Odoo's _copy_recurring_entries:
 *   1. Find recurring journals that are posted
 *   2. Compute next date using _apply_delta_recurring_entries
 *   3. Check if next date is within autoPostUntil limit
 *   4. Copy the journal with the new date
 *   5. Post the new journal automatically (or leave as draft)
 *
 * @param recurringJournalId - the ID of the recurring journal template
 * @param organizationId
 * @param userId
 */
export async function executeRecurringJournal(
  recurringJournalId: string,
  organizationId: string,
  userId: string,
): Promise<{
  executed: boolean
  newJournalId?: string
  newJournalNumber?: string
  nextDate?: string
  message: string
}> {
  const recurring = await db.recurringJournal.findFirst({
    where: { id: recurringJournalId, organizationId, status: 'Active' },
  })

  if (!recurring) {
    return { executed: false, message: 'Recurring journal not found or inactive' }
  }

  // Parse the template (stored as JSON)
  const template = JSON.parse(recurring.template) as {
    journalDate: string
    source?: string
    description?: string
    currency?: string
    lines: Array<{
      accountCode: string
      description?: string
      debit: number
      credit: number
    }>
  }

  const period = recurring.frequency.toLowerCase() as RecurrencePeriod
  if (!['monthly', 'quarterly', 'yearly'].includes(period)) {
    return { executed: false, message: `Unsupported frequency: ${recurring.frequency}` }
  }

  // Compute next date
  const currentDate = recurring.nextRunDate ? new Date(recurring.nextRunDate) : new Date()
  const originDate = recurring.lastRunDate ? new Date(recurring.lastRunDate) : new Date(template.journalDate)
  const nextDate = advanceDate(currentDate, originDate, period)

  // Check if we've passed the end date (if set)
  // In our model, we don't have autoPostUntil, so we just execute once

  // Resolve account IDs from codes
  const accountIds: Record<string, string> = {}
  for (const line of template.lines) {
    if (!accountIds[line.accountCode]) {
      const account = await db.account.findFirst({
        where: { organizationId, code: line.accountCode },
      })
      if (!account) {
        return { executed: false, message: `Account code ${line.accountCode} not found` }
      }
      accountIds[line.accountCode] = account.id
    }
  }

  // Find fiscal period
  const fy = await db.fiscalYear.findFirst({
    where: { organizationId, startDate: { lte: nextDate }, endDate: { gte: nextDate } },
  })
  let periodId: string | null = null
  if (fy) {
    const fp = await db.fiscalPeriod.findFirst({
      where: { fiscalYearId: fy.id, startDate: { lte: nextDate }, endDate: { gte: nextDate } },
    })
    if (fp && fp.status !== 'Closed') {
      periodId = fp.id
    }
  }

  // Generate journal number
  const count = await db.journal.count({ where: { organizationId } })
  const journalNumber = `JE-${nextDate.getFullYear()}-${String(count + 1).padStart(4, '0')}`

  // Calculate totals
  const totalDebit = template.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = template.lines.reduce((s, l) => s + l.credit, 0)

  // Create the journal entry atomically
  const journal = await db.$transaction(async (tx) => {
    const j = await tx.journal.create({
      data: {
        organizationId,
        journalNumber,
        journalDate: nextDate,
        fiscalPeriodId: periodId,
        source: template.source || 'Recurring',
        reference: `REC-${recurring.name}`,
        description: `${recurring.name} — ${recurring.description || 'Recurring entry'} — ${nextDate.toISOString().slice(0, 10)}`,
        currency: template.currency || 'USD',
        exchangeRate: 100,
        status: 'Posted',
        totalDebit,
        totalCredit,
        createdById: userId,
        postedById: userId,
        postedAt: new Date(),
        postingDate: new Date(),
      },
    })

    // Create lines
    for (let i = 0; i < template.lines.length; i++) {
      const line = template.lines[i]
      await tx.journalLine.create({
        data: {
          journalId: j.id,
          lineNumber: i + 1,
          accountId: accountIds[line.accountCode],
          description: line.description || `${recurring.name} — recurring`,
          debit: line.debit,
          credit: line.credit,
        },
      })
    }

    // Compute and store hash
    const { computeAndStoreJournalHash } = await import('./invoice-autopost')
    await computeAndStoreJournalHash(tx, j.id, organizationId)

    return j
  })

  // Update the recurring journal's last/next run dates
  const futureNextDate = advanceDate(nextDate, originDate, period)
  await db.recurringJournal.update({
    where: { id: recurringJournalId },
    data: {
      lastRunDate: nextDate,
      nextRunDate: futureNextDate,
    },
  })

  await logAudit({
    action: 'EXECUTE_RECURRING',
    entityType: 'Journal',
    entityId: journal.id,
    description: `Executed recurring journal "${recurring.name}" → created ${journalNumber} dated ${nextDate.toISOString().slice(0, 10)}`,
    userId,
    organizationId,
  })

  return {
    executed: true,
    newJournalId: journal.id,
    newJournalNumber: journalNumber,
    nextDate: futureNextDate.toISOString().slice(0, 10),
    message: `Created recurring journal ${journalNumber} dated ${nextDate.toISOString().slice(0, 10)}. Next run: ${futureNextDate.toISOString().slice(0, 10)}`,
  }
}

/**
 * Execute ALL active recurring journals that are due.
 * This is Odoo's _autopost_draft_entries equivalent for recurring entries.
 *
 * Should be called by a cron job daily.
 */
export async function executeDueRecurringJournals(
  organizationId: string,
  userId: string,
): Promise<{
  executed: number
  failed: number
  results: Array<{ name: string; journalNumber?: string; error?: string }>
}> {
  const dueRecurring = await db.recurringJournal.findMany({
    where: {
      organizationId,
      status: 'Active',
      nextRunDate: { lte: new Date() },
    },
  })

  let executed = 0
  let failed = 0
  const results: Array<{ name: string; journalNumber?: string; error?: string }> = []

  for (const recurring of dueRecurring) {
    try {
      const result = await executeRecurringJournal(recurring.id, organizationId, userId)
      if (result.executed) {
        executed++
        results.push({ name: recurring.name, journalNumber: result.newJournalNumber })
      } else {
        failed++
        results.push({ name: recurring.name, error: result.message })
      }
    } catch (e) {
      failed++
      results.push({ name: recurring.name, error: e instanceof Error ? e.message : 'Unknown error' })
    }
  }

  return { executed, failed, results }
}
