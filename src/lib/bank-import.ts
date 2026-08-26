/**
 * US Journal ERP — Bank Statement Import Engine
 *
 * Inspired by Odoo's account_bank_statement import.
 *
 * Parses CSV bank statement files and creates BankTransaction records.
 *
 * CSV format (flexible):
 *   date,description,amount,reference
 *   2026-08-01,DEPOSIT CUST PAYMENT,5000.00,DEP-001
 *   2026-08-05,ACH TRANSFER,-1200.00,ACH-005
 *
 * Positive amounts = Credit (deposit/inflow)
 * Negative amounts = Debit (withdrawal/outflow)
 */

import { db } from '@/lib/db'
import { logAudit } from '@/lib/api'

export interface BankStatementLine {
  date: Date
  description: string
  amount: number  // in cents (positive = credit/inflow, negative = debit/outflow)
  reference?: string
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
  transactions: Array<{ id: string; date: string; description: string; amount: number }>
}

/**
 * Parse CSV content into BankStatementLine array.
 * Supports flexible column mapping by header name.
 */
export function parseCsvStatement(csvContent: string): BankStatementLine[] {
  const lines = csvContent.trim().split(/\r?\n/)
  if (lines.length < 2) throw new Error('CSV must have at least a header row and one data row')

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const dateIdx = headers.findIndex(h => h.includes('date'))
  const descIdx = headers.findIndex(h => h.includes('description') || h.includes('memo') || h.includes('narration') || h.includes('details'))
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('value') || h.includes('debit') || h.includes('credit'))
  const refIdx = headers.findIndex(h => h.includes('reference') || h.includes('ref') || h.includes('check'))

  if (dateIdx < 0) throw new Error('CSV must have a "date" column')
  if (amountIdx < 0) throw new Error('CSV must have an "amount" column')

  const results: BankStatementLine[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 2) continue

    const dateStr = cols[dateIdx]?.trim()
    const amountStr = cols[amountIdx]?.trim().replace(/[$,]/g, '')
    const description = descIdx >= 0 ? cols[descIdx]?.trim() : ''
    const reference = refIdx >= 0 ? cols[refIdx]?.trim() : undefined

    if (!dateStr || !amountStr) continue

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) continue

    const amount = Math.round(parseFloat(amountStr) * 100)
    if (isNaN(amount)) continue

    results.push({
      date,
      description: description || 'Bank statement import',
      amount,
      reference,
    })
  }

  return results
}

/**
 * Import bank statement lines into the database.
 * Creates BankTransaction records for each line.
 *
 * @param bankAccountId - target bank account
 * @param csvContent - raw CSV content
 * @param organizationId
 * @param userId
 */
export async function importBankStatement(
  bankAccountId: string,
  csvContent: string,
  organizationId: string,
  userId: string,
): Promise<ImportResult> {
  const bank = await db.bankAccount.findFirst({
    where: { id: bankAccountId, organizationId },
  })
  if (!bank) throw new Error('Bank account not found')

  const lines = parseCsvStatement(csvContent)
  const errors: string[] = []
  const transactions: Array<{ id: string; date: string; description: string; amount: number }> = []
  let imported = 0
  let skipped = 0

  for (const line of lines) {
    try {
      // Check for duplicate (same date + amount + reference)
      const existing = await db.bankTransaction.findFirst({
        where: {
          bankAccountId,
          date: line.date,
          amount: Math.abs(line.amount),
          reference: line.reference || null,
        },
      })
      if (existing) {
        skipped++
        continue
      }

      const txn = await db.bankTransaction.create({
        data: {
          bankAccountId,
          date: line.date,
          amount: Math.abs(line.amount),
          type: line.amount >= 0 ? 'Credit' : 'Debit',
          description: line.description,
          reference: line.reference || null,
          reconciled: false,
        },
      })

      // Update bank account balance
      await db.bankAccount.update({
        where: { id: bankAccountId },
        data: { balance: { increment: line.amount } },
      })

      transactions.push({
        id: txn.id,
        date: txn.date.toISOString().slice(0, 10),
        description: txn.description || '',
        amount: txn.amount,
      })
      imported++
    } catch (e) {
      errors.push(`Row ${imported + skipped + errors.length + 1}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  await logAudit({
    action: 'IMPORT_BANK_STATEMENT',
    entityType: 'BankTransaction',
    description: `Imported ${imported} bank transactions, skipped ${skipped} duplicates, ${errors.length} errors`,
    userId,
    organizationId,
  })

  return { imported, skipped, errors, transactions }
}
