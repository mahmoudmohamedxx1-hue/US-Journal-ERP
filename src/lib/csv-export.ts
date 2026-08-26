/**
 * CSV export utility — converts array of objects to CSV and triggers download.
 */

/** Convert a value to CSV-safe string */
function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Escape quotes by doubling them, wrap in quotes if contains comma/quote/newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Resolve dotted paths like "customer.name" → row.customer.name */
function getNestedValue(row: Record<string, unknown>, key: string): unknown {
  if (!key.includes('.')) return row[key]
  const parts = key.split('.')
  let val: unknown = row
  for (const p of parts) {
    if (val == null) return null
    val = (val as Record<string, unknown>)[p]
  }
  return val
}

/** Export data as CSV file download */
export function exportToCsv(filename: string, rows: Array<Record<string, unknown>>, columns?: Array<{ key: string; label: string }>) {
  if (rows.length === 0) {
    // Download empty file with just headers if we know them
    if (columns && columns.length > 0) {
      const headers = columns.map((c) => escapeCsv(c.label)).join(',')
      downloadCsv(filename, headers)
    }
    return
  }

  // Determine columns
  const cols = columns || Object.keys(rows[0]).map((key) => ({ key, label: key }))

  // Build CSV
  const headerLine = cols.map((c) => escapeCsv(c.label)).join(',')
  const dataLines = rows.map((row) =>
    cols.map((c) => escapeCsv(getNestedValue(row, c.key))).join(',')
  )
  const csv = [headerLine, ...dataLines].join('\n')

  downloadCsv(filename, csv)
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
