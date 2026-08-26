/**
 * US Journal ERP — Journal Types & Sequences
 *
 * Inspired by Odoo's account_journal.
 *
 * Odoo has 6 journal types, each with its own sequence prefix:
 *   - sale:     Customer invoices → INV/2026/0001
 *   - purchase:  Vendor bills → BILL/2026/0001
 *   - cash:      Cash payments → CSH/2026/0001
 *   - bank:      Bank transfers → BNK/2026/0001
 *   - credit:   Credit card → CC/2026/0001
 *   - general:   Miscellaneous → JE/2026/0001
 *
 * This module provides the sequence generation for each type.
 */

export type JournalType = 'sale' | 'purchase' | 'cash' | 'bank' | 'credit' | 'general'

export interface JournalTypeDef {
  type: JournalType
  name: string
  prefix: string  // e.g., "INV", "BILL", "JE"
  description: string
}

export const JOURNAL_TYPES: Record<JournalType, JournalTypeDef> = {
  sale: {
    type: 'sale',
    name: 'Sales',
    prefix: 'INV',
    description: 'Customer invoices journal — entries are auto-created when invoices are posted',
  },
  purchase: {
    type: 'purchase',
    name: 'Purchase',
    prefix: 'BILL',
    description: 'Vendor bills journal — entries are auto-created when bills are posted',
  },
  cash: {
    type: 'cash',
    name: 'Cash',
    prefix: 'CSH',
    description: 'Cash payments journal — for cash receipts and payments',
  },
  bank: {
    type: 'bank',
    name: 'Bank',
    prefix: 'BNK',
    description: 'Bank journal — for bank transfers and electronic payments',
  },
  credit: {
    type: 'credit',
    name: 'Credit Card',
    prefix: 'CC',
    description: 'Credit card journal — for credit card transactions',
  },
  general: {
    type: 'general',
    name: 'Miscellaneous',
    prefix: 'JE',
    description: 'General journal — for manual entries, accruals, adjustments',
  },
}

/**
 * Generate the next journal number for a given type.
 *
 * Format: {PREFIX}/{YEAR}/{NNNN}
 *   e.g., INV/2026/0001, BILL/2026/0002, JE/2026/0042
 *
 * @param type - journal type
 * @param year - the year (from journal date)
 * @param currentCount - current count of journals of this type in this year
 */
export function generateJournalNumber(
  type: JournalType,
  year: number,
  sequence: number,
): string {
  const def = JOURNAL_TYPES[type]
  return `${def.prefix}/${year}/${String(sequence).padStart(4, '0')}`
}

/**
 * Parse a journal number to extract type, year, and sequence.
 */
export function parseJournalNumber(
  journalNumber: string,
): { type: JournalType; year: number; sequence: number } | null {
  // Try to match PREFIX/YEAR/SEQUENCE
  const match = journalNumber.match(/^([A-Z]+)\/(\d{4})\/(\d+)$/)
  if (!match) return null

  const prefix = match[1]
  const year = parseInt(match[2])
  const sequence = parseInt(match[3])

  // Find matching journal type by prefix
  for (const [type, def] of Object.entries(JOURNAL_TYPES)) {
    if (def.prefix === prefix) {
      return { type: type as JournalType, year, sequence }
    }
  }

  return null
}

/**
 * Determine journal type from source field.
 * Used to map existing journals (which have a "source" field) to journal types.
 */
export function inferJournalType(source?: string): JournalType {
  if (!source) return 'general'
  const s = source.toLowerCase()
  if (s === 'ar' || s === 'sale' || s === 'sales' || s === 'invoice') return 'sale'
  if (s === 'ap' || s === 'purchase' || s === 'bill') return 'purchase'
  if (s === 'cash') return 'cash'
  if (s === 'bank' || s === 'reconciliation') return 'bank'
  if (s === 'credit' || s === 'credit card') return 'credit'
  return 'general'
}
