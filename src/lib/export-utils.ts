/**
 * Export utilities — PDF and Excel export for any data.
 * Uses jspdf (client-side PDF generation) and xlsx (Excel).
 */

import * as XLSX from 'xlsx'

/** Export data to Excel (.xlsx) file */
export function exportToExcel(filename: string, rows: Array<Record<string, unknown>>, columns?: Array<{ key: string; label: string }>) {
  const cols = columns || Object.keys(rows[0] || {}).map((key) => ({ key, label: key }))
  const data = rows.map((row) => {
    const obj: Record<string, unknown> = {}
    for (const c of cols) {
      obj[c.label] = row[c.key]
    }
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

/** Export data to CSV file */
export function exportToCsv(filename: string, rows: Array<Record<string, unknown>>, columns?: Array<{ key: string; label: string }>) {
  if (rows.length === 0 && columns && columns.length > 0) {
    downloadCsv(filename, columns.map((c) => escapeCsv(c.label)).join(','))
    return
  }
  const cols = columns || Object.keys(rows[0] || {}).map((key) => ({ key, label: key }))
  const headerLine = cols.map((c) => escapeCsv(c.label)).join(',')
  const dataLines = rows.map((row) => cols.map((c) => escapeCsv(row[c.key])).join(','))
  downloadCsv(filename, [headerLine, ...dataLines].join('\n'))
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`
  return str
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename)
}

/** Export data to PDF file using jsPDF + autoTable */
export async function exportToPdf(
  filename: string,
  title: string,
  rows: Array<Record<string, unknown>>,
  columns: Array<{ key: string; label: string }>,
  subtitle?: string,
) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ orientation: 'landscape' })

  // Title
  doc.setFontSize(16)
  doc.text(title, 14, 20)

  // Subtitle (optional)
  if (subtitle) {
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(subtitle, 14, 27)
    doc.setTextColor(0)
  }

  // Date
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, subtitle ? 33 : 27)
  doc.setTextColor(0)

  // Table
  const tableData = rows.map((row) => columns.map((c) => formatPdfCell(row[c.key])))
  autoTable(doc, {
    head: [columns.map((c) => c.label)],
    body: tableData,
    startY: subtitle ? 38 : 32,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  })

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10)
    doc.text('US Journal ERP', 14, doc.internal.pageSize.height - 10)
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

function formatPdfCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    // If it looks like cents (large integer), format as dollars
    if (value > 1000 && Number.isInteger(value)) {
      return `$${(value / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    return String(value)
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value).toLocaleDateString('en-US')
  }
  return String(value)
}

function triggerDownload(blob: Blob, filename: string) {
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
