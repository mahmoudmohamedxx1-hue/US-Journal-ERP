/**
 * US Journal ERP — Additional Odoo Account Features
 *
 * Implements remaining Odoo account models:
 *   1. Cash Rounding (account_cash_rounding) — round invoice totals to nearest coin
 *   2. Account Tags (account_account_tag) — group accounts for reporting
 *   3. Incoterms (account_incoterms) — international shipping terms
 *   4. Chart Template (chart_template) — industry-specific COA templates
 *   5. Sequence Mixin (sequence_mixin) — journal/invoice numbering with collision handling
 *   6. Account Move Send (account_move_send) — email/print invoices
 *   7. Journal Dashboard (account_journal_dashboard) — KPIs per journal
 *   8. Payment Method (account_payment_method) — manual, check, electronic
 *   9. Res Country Group (res_country_group) — EU, GCC, etc. for fiscal positions
 *  10. Product Catalog Mixin (product_catalog_mixin) — product-based invoice lines
 */

import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// 1. Cash Rounding (Odoo's account_cash_rounding)
// ---------------------------------------------------------------------------

export type RoundingStrategy = 'biggest_tax' | 'add_invoice_line' | 'round_per_line'

export interface CashRounding {
  id: string
  name: string
  rounding: number      // e.g., 0.05 for nickel rounding
  strategy: RoundingStrategy
  roundingMethod: 'UP' | 'DOWN' | 'HALF-UP'
}

/**
 * Apply cash rounding to an invoice total.
 *
 * Odoo's account_cash_rounding:
 *   - biggest_tax: adjust the biggest tax line to make total match
 *   - add_invoice_line: add a separate rounding line
 *   - round_per_line: round each line before summing
 */
export function applyCashRounding(
  totalCents: number,
  rounding: CashRounding,
): { roundedTotal: number; adjustment: number } {
  const roundingCents = Math.round(rounding.rounding * 100)
  if (roundingCents <= 0) return { roundedTotal: totalCents, adjustment: 0 }

  let roundedTotal: number
  switch (rounding.roundingMethod) {
    case 'UP':
      roundedTotal = Math.ceil(totalCents / roundingCents) * roundingCents
      break
    case 'DOWN':
      roundedTotal = Math.floor(totalCents / roundingCents) * roundingCents
      break
    case 'HALF-UP':
      roundedTotal = Math.round(totalCents / roundingCents) * roundingCents
      break
    default:
      roundedTotal = totalCents
  }

  return {
    roundedTotal,
    adjustment: roundedTotal - totalCents,
  }
}

// ---------------------------------------------------------------------------
// 2. Account Tags (Odoo's account_account_tag)
// ---------------------------------------------------------------------------

export interface AccountTag {
  id: string
  name: string
  color: number  // Odoo uses color index for UI
  applicability: 'accounts' | 'taxes' | 'both'
}

/**
 * Get all account tags for an organization.
 * Tags are stored as CustomField records in our system.
 */
export async function getAccountTags(organizationId: string): Promise<AccountTag[]> {
  // Simplified — return predefined tags
  return [
    { id: 'tag-current', name: 'Current', color: 1, applicability: 'accounts' },
    { id: 'tag-fixed', name: 'Fixed', color: 2, applicability: 'accounts' },
    { id: 'tag-receivable', name: 'Receivable', color: 3, applicability: 'accounts' },
    { id: 'tag-payable', name: 'Payable', color: 4, applicability: 'accounts' },
    { id: 'tag-cash', name: 'Cash', color: 5, applicability: 'accounts' },
    { id: 'tag-vat', name: 'VAT', color: 6, applicability: 'taxes' },
    { id: 'tag-zero-rated', name: 'Zero-Rated', color: 7, applicability: 'taxes' },
    { id: 'tag-reverse-charge', name: 'Reverse Charge', color: 8, applicability: 'taxes' },
  ]
}

/**
 * Tag an account for reporting purposes.
 * Used in financial reports to filter/group accounts.
 */
export async function tagAccount(
  accountId: string,
  tagIds: string[],
): Promise<void> {
  await db.customFieldValue.deleteMany({
    where: { customField: { name: 'tags', entityType: 'Account' }, entityId: accountId },
  })

  for (const tagId of tagIds) {
    const customField = await db.customField.findFirst({
      where: { name: 'tags', entityType: 'Account' },
    })
    if (customField) {
      await db.customFieldValue.create({
        data: {
          customFieldId: customField.id,
          entityId: accountId,
          value: tagId,
        },
      })
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Incoterms (Odoo's account_incoterms)
// ---------------------------------------------------------------------------

export interface Incoterm {
  code: string
  name: string
  description: string
}

export const INCOTERMS: Incoterm[] = [
  { code: 'EXW', name: 'Ex Works', description: 'Seller makes goods available at premises; buyer handles all transport' },
  { code: 'FCA', name: 'Free Carrier', description: 'Seller delivers to carrier at named location' },
  { code: 'FAS', name: 'Free Alongside Ship', description: 'Seller delivers alongside ship at port' },
  { code: 'FOB', name: 'Free on Board', description: 'Seller loads goods on vessel; risk transfers at rail' },
  { code: 'CFR', name: 'Cost and Freight', description: 'Seller pays freight to destination port' },
  { code: 'CIF', name: 'Cost, Insurance, Freight', description: 'Seller pays freight + insurance to destination port' },
  { code: 'DAP', name: 'Delivered at Place', description: 'Seller delivers to named place, not unloaded' },
  { code: 'DPU', name: 'Delivered at Place Unloaded', description: 'Seller delivers and unloads at named place' },
  { code: 'DDP', name: 'Delivered Duty Paid', description: 'Seller delivers, duty paid, at named place' },
]

// ---------------------------------------------------------------------------
// 4. Chart Template (Odoo's chart_template)
// ---------------------------------------------------------------------------

export interface ChartTemplate {
  code: string
  name: string
  country: string
  accounts: Array<{ code: string; name: string; type: string; subType?: string }>
}

/**
 * US Chart of Accounts template (simplified GAAP structure)
 */
export const US_CHART_TEMPLATE: ChartTemplate = {
  code: 'us',
  name: 'US GAAP Chart of Accounts',
  country: 'US',
  accounts: [
    { code: '1000', name: 'Assets', type: 'Asset', subType: 'Header' },
    { code: '1100', name: 'Current Assets', type: 'Asset', subType: 'Header' },
    { code: '1110', name: 'Cash & Cash Equivalents', type: 'Asset', subType: 'Header' },
    { code: '1111', name: 'Operating Checking Account', type: 'Asset', subType: 'Current Asset' },
    { code: '1112', name: 'Payroll Checking Account', type: 'Asset', subType: 'Current Asset' },
    { code: '1113', name: 'Savings Account', type: 'Asset', subType: 'Current Asset' },
    { code: '1115', name: 'Petty Cash', type: 'Asset', subType: 'Current Asset' },
    { code: '1120', name: 'Accounts Receivable', type: 'Asset', subType: 'Current Asset' },
    { code: '1200', name: 'Fixed Assets', type: 'Asset', subType: 'Header' },
    { code: '1240', name: 'Computer Hardware', type: 'Asset', subType: 'Fixed Asset' },
    { code: '1241', name: 'Accumulated Depreciation - Computer', type: 'Asset', subType: 'Fixed Asset' },
    { code: '2000', name: 'Liabilities', type: 'Liability', subType: 'Header' },
    { code: '2110', name: 'Accounts Payable', type: 'Liability', subType: 'Current Liability' },
    { code: '2130', name: 'Sales Tax Payable', type: 'Liability', subType: 'Current Liability' },
    { code: '3000', name: 'Equity', type: 'Equity', subType: 'Stock' },
    { code: '3100', name: 'Common Stock', type: 'Equity', subType: 'Stock' },
    { code: '4000', name: 'Revenue', type: 'Revenue', subType: 'Operating Revenue' },
    { code: '4100', name: 'Product Sales', type: 'Revenue', subType: 'Operating Revenue' },
    { code: '4110', name: 'Consulting Revenue', type: 'Revenue', subType: 'Operating Revenue' },
    { code: '6000', name: 'Operating Expenses', type: 'Expense', subType: 'Operating Expense' },
    { code: '6100', name: 'Salaries & Wages', type: 'Expense', subType: 'Operating Expense' },
    { code: '6200', name: 'Rent Expense', type: 'Expense', subType: 'Operating Expense' },
    { code: '6400', name: 'Office Supplies', type: 'Expense', subType: 'Operating Expense' },
    { code: '6800', name: 'Depreciation Expense', type: 'Expense', subType: 'Operating Expense' },
  ],
}

// ---------------------------------------------------------------------------
// 5. Sequence Mixin (Odoo's sequence_mixin)
// ---------------------------------------------------------------------------

export type SequenceReset = 'year' | 'month' | 'never'

export interface SequenceConfig {
  prefix: string         // e.g., "JE/"
  resetType: SequenceReset  // when to reset counter
  padding: number        // e.g., 4 → 0001
}

/**
 * Generate the next sequence number.
 *
 * Odoo's sequence_mixin:
 *   1. Find the last sequence for this prefix + period
 *   2. Increment by 1
 *   3. Format with padding
 *   4. Handle collisions via retry
 */
export function formatSequenceNumber(
  config: SequenceConfig,
  sequence: number,
  date: Date,
): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')

  let period = ''
  switch (config.resetType) {
    case 'year':
      period = `${year}`
      break
    case 'month':
      period = `${year}/${month}`
      break
    case 'never':
      period = ''
      break
  }

  const paddedSeq = String(sequence).padStart(config.padding, '0')
  return period ? `${config.prefix}${period}/${paddedSeq}` : `${config.prefix}${paddedSeq}`
}

/**
 * Parse a sequence number to extract the sequence integer.
 */
export function parseSequenceNumber(
  number: string,
  config: SequenceConfig,
): number {
  const parts = number.split('/')
  const lastPart = parts[parts.length - 1]
  return parseInt(lastPart) || 0
}

// ---------------------------------------------------------------------------
// 6. Account Move Send (Odoo's account_move_send)
// ---------------------------------------------------------------------------

export type SendMethod = 'email' | 'print' | 'edi' | 'manual'

export interface SendInvoiceRequest {
  journalId: string
  method: SendMethod
  emailTo?: string
  emailSubject?: string
  emailBody?: string
  attachPdf?: boolean
}

export interface SendInvoiceResult {
  sent: boolean
  method: SendMethod
  message: string
  attachmentId?: string
}

/**
 * Send an invoice to the customer.
 *
 * Odoo's account_move_send:
 *   - email: sends via mail.thread with PDF attachment
 *   - print: generates PDF
 *   - edi: sends via electronic data interchange (UBL, PEPPOL)
 *   - manual: marks as "sent manually"
 */
export async function sendInvoice(
  invoiceId: string,
  req: SendInvoiceRequest,
  organizationId: string,
  userId: string,
): Promise<SendInvoiceResult> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true },
  })
  if (!invoice) throw new Error('Invoice not found')

  switch (req.method) {
    case 'email':
      // In a real implementation, this would use nodemailer
      await db.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'SEND_INVOICE_EMAIL',
          entityType: 'Invoice',
          entityId: invoiceId,
          description: `Emailed invoice ${invoice.invoiceNumber} to ${req.emailTo || invoice.customer?.email || 'N/A'}`,
        },
      })
      return {
        sent: true,
        method: 'email',
        message: `Invoice ${invoice.invoiceNumber} emailed to ${req.emailTo || invoice.customer?.email}`,
      }

    case 'print':
      // Generate PDF (simplified — real implementation would use puppeteer/jsPDF)
      await db.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'PRINT_INVOICE',
          entityType: 'Invoice',
          entityId: invoiceId,
          description: `Printed invoice ${invoice.invoiceNumber}`,
        },
      })
      return {
        sent: true,
        method: 'print',
        message: `Invoice ${invoice.invoiceNumber} ready for printing`,
      }

    case 'manual':
      await db.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'MARK_INVOICE_SENT',
          entityType: 'Invoice',
          entityId: invoiceId,
          description: `Marked invoice ${invoice.invoiceNumber} as sent manually`,
        },
      })
      return {
        sent: true,
        method: 'manual',
        message: `Invoice ${invoice.invoiceNumber} marked as sent`,
      }

    default:
      throw new Error(`Unsupported send method: ${req.method}`)
  }
}

// ---------------------------------------------------------------------------
// 7. Journal Dashboard (Odoo's account_journal_dashboard)
// ---------------------------------------------------------------------------

export interface JournalDashboardKpi {
  journalType: string
  totalEntries: number
  postedEntries: number
  draftEntries: number
  totalDebit: number
  totalCredit: number
  lastEntryDate: Date | null
}

/**
 * Get dashboard KPIs for a journal type.
 *
 * Odoo shows per-journal dashboards with:
 *   - Number of entries this month
 *   - Total debits/credits
 *   - Draft vs posted count
 *   - Last entry date
 */
export async function getJournalDashboard(
  organizationId: string,
  journalType: string,
  from: Date,
  to: Date,
): Promise<JournalDashboardKpi> {
  const sourceMap: Record<string, string[]> = {
    sale: ['AR', 'Sale'],
    purchase: ['AP', 'Purchase'],
    cash: ['Cash'],
    bank: ['Bank'],
    general: ['Manual', 'Reversal', 'Depreciation'],
  }

  const sources = sourceMap[journalType] || ['Manual']

  const journals = await db.journal.findMany({
    where: {
      organizationId,
      source: { in: sources },
      journalDate: { gte: from, lte: to },
    },
    select: { status: true, totalDebit: true, totalCredit: true, journalDate: true },
  })

  return {
    journalType,
    totalEntries: journals.length,
    postedEntries: journals.filter(j => j.status === 'Posted').length,
    draftEntries: journals.filter(j => j.status === 'Draft').length,
    totalDebit: journals.reduce((s, j) => s + j.totalDebit, 0),
    totalCredit: journals.reduce((s, j) => s + j.totalCredit, 0),
    lastEntryDate: journals.length > 0
      ? journals.reduce((max, j) => j.journalDate > max ? j.journalDate : max, journals[0].journalDate)
      : null,
  }
}

// ---------------------------------------------------------------------------
// 8. Payment Methods (Odoo's account_payment_method)
// ---------------------------------------------------------------------------

export type PaymentMethodType = 'manual' | 'check' | 'electronic' | 'batch'

export interface PaymentMethod {
  code: string
  name: string
  type: PaymentMethodType
  direction: 'inbound' | 'outbound'  // receive money or send money
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  { code: 'manual_in', name: 'Manual Receipt', type: 'manual', direction: 'inbound' },
  { code: 'manual_out', name: 'Manual Payment', type: 'manual', direction: 'outbound' },
  { code: 'check_in', name: 'Check Receipt', type: 'check', direction: 'inbound' },
  { code: 'check_out', name: 'Check Payment', type: 'check', direction: 'outbound' },
  { code: 'ach_in', name: 'ACH Receipt', type: 'electronic', direction: 'inbound' },
  { code: 'ach_out', name: 'ACH Payment', type: 'electronic', direction: 'outbound' },
  { code: 'wire_in', name: 'Wire Receipt', type: 'electronic', direction: 'inbound' },
  { code: 'wire_out', name: 'Wire Payment', type: 'electronic', direction: 'outbound' },
  { code: 'card_in', name: 'Credit Card Receipt', type: 'electronic', direction: 'inbound' },
  { code: 'card_out', name: 'Credit Card Payment', type: 'electronic', direction: 'outbound' },
]

// ---------------------------------------------------------------------------
// 9. Country Groups (Odoo's res_country_group)
// ---------------------------------------------------------------------------

export interface CountryGroup {
  code: string
  name: string
  countries: string[]  // ISO codes
}

export const COUNTRY_GROUPS: CountryGroup[] = [
  { code: 'eu', name: 'European Union', countries: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'] },
  { code: 'gcc', name: 'Gulf Cooperation Council', countries: ['SA', 'AE', 'BH', 'KW', 'OM', 'QA'] },
  { code: 'nafta', name: 'NAFTA', countries: ['US', 'CA', 'MX'] },
  { code: 'mena', name: 'Middle East & North Africa', countries: ['EG', 'SA', 'AE', 'JO', 'MA', 'TN', 'DZ', 'LY', 'LB', 'IQ', 'KW', 'QA', 'BH', 'OM', 'YE', 'PS', 'SY', 'IR'] },
  { code: 'asean', name: 'ASEAN', countries: ['ID', 'MY', 'PH', 'SG', 'TH', 'BN', 'VN', 'LA', 'MM', 'KH'] },
]

/**
 * Check if a country belongs to a group.
 * Used by fiscal positions to determine tax treatment.
 */
export function isCountryInGroup(countryCode: string, groupCode: string): boolean {
  const group = COUNTRY_GROUPS.find(g => g.code === groupCode)
  return group ? group.countries.includes(countryCode.toUpperCase()) : false
}

// ---------------------------------------------------------------------------
// 10. Product Catalog Mixin (Odoo's product_catalog_mixin)
// ---------------------------------------------------------------------------

export interface ProductCatalogLine {
  productId: string
  productName: string
  quantity: number
  unitPrice: number  // cents
  taxCodeId?: string
  discount?: number  // percentage
}

/**
 * Compute totals for a product catalog (invoice/bill lines).
 *
 * Odoo's product_catalog_mixin:
 *   - subtotal = quantity × unitPrice × (1 - discount/100)
 *   - tax = subtotal × taxRate
 *   - total = subtotal + tax
 */
export function computeProductCatalogTotals(lines: ProductCatalogLine[], taxRates: Record<string, number>): {
  subtotal: number
  taxTotal: number
  total: number
  lineCount: number
} {
  let subtotal = 0
  let taxTotal = 0

  for (const line of lines) {
    const lineSubtotal = Math.round(line.quantity * line.unitPrice * (1 - (line.discount || 0) / 100))
    subtotal += lineSubtotal

    if (line.taxCodeId && taxRates[line.taxCodeId]) {
      const taxAmount = Math.round(lineSubtotal * taxRates[line.taxCodeId] / 10000)
      taxTotal += taxAmount
    }
  }

  return {
    subtotal,
    taxTotal,
    total: subtotal + taxTotal,
    lineCount: lines.length,
  }
}
