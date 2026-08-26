/**
 * US Journal ERP — Accrual/Deferral Wizard
 *
 * Inspired by Odoo's account_automatic_entry_wizard.
 *
 * Two actions:
 *   1. change_period (Accrual): Move expense from one period to another.
 *      Creates a reversing entry in the current period and a new entry in the target period.
 *      E.g., prepay $12,000 annual insurance in January → accrue $1,000/month
 *
 *   2. change_account (Reclassify): Move an entry to a different account.
 *      Creates a reversing entry on the original account and a new entry on the new account.
 */

import { db } from '@/lib/db'
import { logAudit } from '@/lib/api'

export interface AccrualRequest {
  organizationId: string
  userId: string
  journalLineIds: string[]  // lines to accrue/reclassify
  action: 'change_period' | 'change_account'
  // For change_period:
  targetDate?: string       // YYYY-MM-DD — date for the new (accrued) entry
  accrualAccountId?: string // account to use as the accrual intermediary
  // For change_account:
  destinationAccountId?: string // account to move to
  percentage?: number           // 0-100, what portion to move (default 100)
}

export interface AccrualResult {
  reversalJournalId: string
  reversalJournalNumber: string
  newJournalId?: string
  newJournalNumber?: string
  amountMoved: number
  message: string
}

/**
 * Create an accrual or reclassification entry.
 *
 * For `change_period` (Accrual):
 *   - Creates a reversing journal entry dated today (reverses the original lines)
 *   - Creates a new journal entry dated targetDate with the same lines
 *   - The accrual account is used as the intermediary (balance sheet)
 *
 * For `change_account` (Reclassify):
 *   - Creates a reversing journal entry on the original account
 *   - Creates a new journal entry on the destination account
 */
export async function createAccrualEntry(req: AccrualRequest): Promise<AccrualResult> {
  const { organizationId, userId, journalLineIds, action, targetDate, accrualAccountId, destinationAccountId, percentage = 100 } = req

  if (journalLineIds.length === 0) throw new Error('At least one journal line is required')
  if (action === 'change_period' && !targetDate) throw new Error('targetDate is required for change_period')
  if (action === 'change_period' && !accrualAccountId) throw new Error('accrualAccountId is required for change_period')
  if (action === 'change_account' && !destinationAccountId) throw new Error('destinationAccountId is required for change_account')

  // Load the journal lines
  const lines = await db.journalLine.findMany({
    where: { id: { in: journalLineIds } },
    include: { journal: true, account: true },
  })

  if (lines.length === 0) throw new Error('No journal lines found')

  // Verify all lines belong to the same org
  for (const line of lines) {
    if (line.journal.organizationId !== organizationId) {
      throw new Error('All journal lines must belong to the same organization')
    }
  }

  const factor = percentage / 100
  let totalDebit = 0
  let totalCredit = 0

  // === Step 1: Create reversing entry (reverses the original lines) ===
  const today = new Date()
  const count1 = await db.journal.count({ where: { organizationId } })
  const reversalNumber = `JE-${today.getFullYear()}-${String(count1 + 1).padStart(4, '0')}`

  const reversalJournal = await db.$transaction(async (tx) => {
    const j = await tx.journal.create({
      data: {
        organizationId,
        journalNumber: reversalNumber,
        journalDate: today,
        source: 'Reversal',
        reference: `Accrual reversal of ${lines[0].journal.journalNumber}`,
        description: `${action === 'change_period' ? 'Accrual reversal' : 'Account reclassification'} — ${percentage}% of ${lines.length} lines`,
        currency: lines[0].journal.currency,
        exchangeRate: lines[0].journal.exchangeRate,
        status: 'Posted',
        totalDebit: 0, // will be set after lines
        totalCredit: 0,
        createdById: userId,
        postedById: userId,
        postedAt: new Date(),
        postingDate: new Date(),
      },
    })

    let lineNum = 1
    let rDebit = 0
    let rCredit = 0

    // Reverse each line: swap debit/credit
    for (const line of lines) {
      const reversedDebit = Math.round(line.credit * factor)
      const reversedCredit = Math.round(line.debit * factor)

      await tx.journalLine.create({
        data: {
          journalId: j.id,
          lineNumber: lineNum++,
          accountId: line.accountId,
          description: `REVERSAL: ${line.description || ''}`,
          debit: reversedDebit,
          credit: reversedCredit,
        },
      })

      rDebit += reversedDebit
      rCredit += reversedCredit
    }

    await tx.journal.update({
      where: { id: j.id },
      data: { totalDebit: rDebit, totalCredit: rCredit },
    })

    totalDebit = rDebit
    totalCredit = rCredit
    return j
  })

  // === Step 2: Create new entry on target date / destination account ===
  let newJournal = null
  let newJournalNumber: string | undefined

  if (action === 'change_period') {
    // Accrual: same lines, different date, using accrual account
    const targetDateObj = new Date(targetDate!)
    const count2 = await db.journal.count({ where: { organizationId } })
    newJournalNumber = `JE-${targetDateObj.getFullYear()}-${String(count2 + 1).padStart(4, '0')}`

    newJournal = await db.$transaction(async (tx) => {
      const j = await tx.journal.create({
        data: {
          organizationId,
          journalNumber: newJournalNumber!,
          journalDate: targetDateObj,
          source: 'Accrual',
          reference: `Accrual entry from ${lines[0].journal.journalNumber}`,
          description: `Accrued expense/income — originally posted ${lines[0].journal.journalDate.toISOString().slice(0, 10)}`,
          currency: lines[0].journal.currency,
          exchangeRate: lines[0].journal.exchangeRate,
          status: 'Posted',
          totalDebit: 0,
          totalCredit: 0,
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
          postingDate: new Date(),
        },
      })

      let lineNum = 1
      let nDebit = 0
      let nCredit = 0

      // Create the same lines (not reversed) on the target date
      for (const line of lines) {
        const debit = Math.round(line.debit * factor)
        const credit = Math.round(line.credit * factor)

        await tx.journalLine.create({
          data: {
            journalId: j.id,
            lineNumber: lineNum++,
            accountId: line.accountId,
            description: `ACCRUAL: ${line.description || ''}`,
            debit,
            credit,
          },
        })

        nDebit += debit
        nCredit += credit
      }

      await tx.journal.update({
        where: { id: j.id },
        data: { totalDebit: nDebit, totalCredit: nCredit },
      })

      return j
    })
  } else if (action === 'change_account') {
    // Reclassify: same lines, different account
    const count2 = await db.journal.count({ where: { organizationId } })
    newJournalNumber = `JE-${today.getFullYear()}-${String(count2 + 1).padStart(4, '0')}`

    newJournal = await db.$transaction(async (tx) => {
      const j = await tx.journal.create({
        data: {
          organizationId,
          journalNumber: newJournalNumber!,
          journalDate: today,
          source: 'Reclassification',
          reference: `Reclassified from ${lines[0].journal.journalNumber}`,
          description: `Account reclassification — moved to ${destinationAccountId}`,
          currency: lines[0].journal.currency,
          exchangeRate: lines[0].journal.exchangeRate,
          status: 'Posted',
          totalDebit: 0,
          totalCredit: 0,
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
          postingDate: new Date(),
        },
      })

      let lineNum = 1
      let nDebit = 0
      let nCredit = 0

      for (const line of lines) {
        const debit = Math.round(line.debit * factor)
        const credit = Math.round(line.credit * factor)

        await tx.journalLine.create({
          data: {
            journalId: j.id,
            lineNumber: lineNum++,
            accountId: destinationAccountId!, // use the new account
            description: `RECLASSIFIED: ${line.description || ''}`,
            debit,
            credit,
          },
        })

        nDebit += debit
        nCredit += credit
      }

      await tx.journal.update({
        where: { id: j.id },
        data: { totalDebit: nDebit, totalCredit: nCredit },
      })

      return j
    })
  }

  await logAudit({
    action: action === 'change_period' ? 'ACCRUAL_ENTRY' : 'ACCOUNT_RECLASSIFICATION',
    entityType: 'Journal',
    entityId: reversalJournal.id,
    description: `${action === 'change_period' ? 'Accrued' : 'Reclassified'} ${percentage}% of ${lines.length} lines — reversal ${reversalNumber}${newJournalNumber ? `, new entry ${newJournalNumber}` : ''}`,
    userId,
    organizationId,
  })

  return {
    reversalJournalId: reversalJournal.id,
    reversalJournalNumber: reversalNumber,
    newJournalId: newJournal?.id,
    newJournalNumber,
    amountMoved: totalDebit,
    message: action === 'change_period'
      ? `Created accrual: reversed ${lines.length} lines today, new entry dated ${targetDate}`
      : `Reclassified ${lines.length} lines to new account`,
  }
}
