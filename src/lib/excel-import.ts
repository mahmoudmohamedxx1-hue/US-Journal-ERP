/**
 * Excel import utility — parse uploaded .xlsx files into structured data.
 * Used for importing journal entries from Excel.
 */

import * as XLSX from 'xlsx'

export interface ParsedJournalRow {
  accountCode: string
  description?: string
  debit: number  // in dollars (will be converted to cents by API)
  credit: number // in dollars
}

export interface ParsedJournal {
  journalDate: string
  description?: string
  reference?: string
  source?: string
  lines: ParsedJournalRow[]
  errors: string[]
}

/**
 * Parse an Excel file into journal entries.
 *
 * Expected Excel format (template):
 * Row 1 (header): Date | Description | Reference | Source | AccountCode | LineDescription | Debit | Credit
 * Row 2+: data rows
 *
 * Multiple rows with the same Date+Description+Reference are grouped
 * into a single journal entry with multiple lines.
 */
export async function parseJournalExcel(file: File): Promise<{ journals: ParsedJournal[]; errors: string[] }> {
  const arrayBuffer = await file.arrayBuffer()
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 'A' })

  const errors: string[] = []
  const journals: ParsedJournal[] = []

  if (rows.length < 2) {
    errors.push('File must contain at least a header row and one data row.')
    return { journals, errors }
  }

  // Detect column positions from header row
  const header = rows[0]
  const colMap = detectColumns(header)

  if (!colMap.accountCode) {
    errors.push('Missing required column: AccountCode')
  }
  if (!colMap.debit && !colMap.credit) {
    errors.push('Missing required columns: Debit and/or Credit')
  }

  if (errors.length > 0) return { journals, errors }

  // Group rows by Date+Description into journals
  const journalMap = new Map<string, ParsedJournal>()

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const date = String(row[colMap.date || 'A'] || '').trim()
    const description = colMap.description ? String(row[colMap.description] || '').trim() : ''
    const reference = colMap.reference ? String(row[colMap.reference] || '').trim() : ''
    const source = colMap.source ? String(row[colMap.source] || '').trim() : 'Manual'
    const accountCode = String(row[colMap.accountCode!] || '').trim()
    const lineDesc = colMap.lineDescription ? String(row[colMap.lineDescription] || '').trim() : ''
    const debit = colMap.debit ? Number(row[colMap.debit] || 0) : 0
    const credit = colMap.credit ? Number(row[colMap.credit] || 0) : 0

    if (!accountCode && !date) continue // skip empty rows

    if (!accountCode) {
      errors.push(`Row ${i + 1}: Missing AccountCode`)
      continue
    }

    if (!date) {
      errors.push(`Row ${i + 1}: Missing Date`)
      continue
    }

    // Normalize date to YYYY-MM-DD
    const normalizedDate = normalizeDate(date)
    if (!normalizedDate) {
      errors.push(`Row ${i + 1}: Invalid date format "${date}"`)
      continue
    }

    if (debit === 0 && credit === 0) {
      errors.push(`Row ${i + 1}: Both debit and credit are 0 for account ${accountCode}`)
      continue
    }

    // Group key: date + description (same journal = same date + same description)
    const groupKey = `${normalizedDate}|||${description}|||${reference}`
    if (!journalMap.has(groupKey)) {
      journalMap.set(groupKey, {
        journalDate: normalizedDate,
        description: description || undefined,
        reference: reference || undefined,
        source: source || 'Manual',
        lines: [],
        errors: [],
      })
    }

    const journal = journalMap.get(groupKey)!
    journal.lines.push({
      accountCode,
      description: lineDesc || undefined,
      debit,
      credit,
    })
  }

  // Validate each journal: must have at least 2 lines and be balanced (if submitting)
  for (const journal of journalMap.values()) {
    if (journal.lines.length < 2) {
      journal.errors.push(`Journal "${journal.description || journal.journalDate}" has only ${journal.lines.length} line(s) — minimum 2 required`)
    }
    const totalDebit = journal.lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = journal.lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      journal.errors.push(`Journal "${journal.description || journal.journalDate}" is not balanced: debits=${totalDebit}, credits=${totalCredit}`)
    }
    journals.push(journal)
  }

  return { journals, errors }
}

function detectColumns(header: Record<string, unknown>): Record<string, string | null> {
  const result: Record<string, string | null> = {
    date: null,
    description: null,
    reference: null,
    source: null,
    accountCode: null,
    lineDescription: null,
    debit: null,
    credit: null,
  }

  for (const [col, val] of Object.entries(header)) {
    const headerText = String(val || '').toLowerCase().replace(/\s+/g, '')
    if (headerText.includes('date')) result.date = col
    else if (headerText.includes('description') && !result.description) result.description = col
    else if (headerText.includes('description')) result.lineDescription = col
    else if (headerText.includes('reference') || headerText.includes('ref')) result.reference = col
    else if (headerText.includes('source')) result.source = col
    else if (headerText.includes('accountcode') || headerText.includes('account_code') || headerText.includes('code')) result.accountCode = col
    else if (headerText.includes('linedescription') || headerText.includes('line_description') || headerText.includes('memo')) result.lineDescription = col
    else if (headerText === 'debit' || headerText.includes('debit')) result.debit = col
    else if (headerText === 'credit' || headerText.includes('credit')) result.credit = col
  }

  return result
}

function normalizeDate(dateStr: string): string | null {
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  // Try MM/DD/YYYY
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, m, d, y] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // Try DD/MM/YYYY (if first > 12, it's a day)
  const match2 = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match2) {
    const [, a, b, y] = match2
    if (Number(a) > 12) return `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
  }
  // Try Excel serial date
  const num = Number(dateStr)
  if (!isNaN(num) && num > 30000 && num < 80000) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000))
    return date.toISOString().slice(0, 10)
  }
  return null
}

/** Download a blank Excel template for journal entry import */
export function downloadJournalTemplate() {
  const template = [
    { Date: '2026-08-25', Description: 'Cash Sale', Reference: 'INV-001', Source: 'Manual', AccountCode: '1000', LineDescription: 'Cash received', Debit: 100.00, Credit: 0 },
    { Date: '2026-08-25', Description: 'Cash Sale', Reference: 'INV-001', Source: 'Manual', AccountCode: '4000', LineDescription: 'Sales revenue', Debit: 0, Credit: 100.00 },
    { Date: '2026-08-26', Description: 'Office Supplies', Reference: 'BILL-001', Source: 'AP', AccountCode: '6400', LineDescription: 'Supplies', Debit: 50.00, Credit: 0 },
    { Date: '2026-08-26', Description: 'Office Supplies', Reference: 'BILL-001', Source: 'AP', AccountCode: '2000', LineDescription: 'Accounts Payable', Debit: 0, Credit: 50.00 },
  ]

  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Journal Entries')
  XLSX.writeFile(wb, 'journal-import-template.xlsx')
}
