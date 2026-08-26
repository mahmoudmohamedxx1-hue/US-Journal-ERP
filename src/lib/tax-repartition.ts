/**
 * US Journal ERP — Tax Repartition Engine
 *
 * Inspired by Odoo's account_tax_repartition_line.
 *
 * Odoo splits tax computation into "repartition lines":
 *   - 'base': the portion of the tax that is the base (no account, just tagging)
 *   - 'tax': the actual tax amount, posted to a specific account
 *
 * Each repartition line has a factor_percent (e.g., 50% to city tax, 50% to state tax).
 *
 * Example: 10% sales tax split 60% state / 40% city:
 *   Line 1: base, 100% (no account — just tagging)
 *   Line 2: tax, 60%, state_tax_payable_account
 *   Line 3: tax, 40%, city_tax_payable_account
 *
 * For a $100 invoice:
 *   base = $100
 *   state tax = $100 × 10% × 60% = $6.00
 *   city tax = $100 × 10% × 40% = $4.00
 *   total tax = $10.00
 */

export interface TaxRepartitionLine {
  id: string
  repartitionType: 'base' | 'tax'
  factorPercent: number  // 0-100, what portion of the tax goes to this line
  accountId: string | null  // null for 'base' type
  documentType: 'invoice' | 'refund'
  tagIds: string[]  // for reporting tags
}

export interface TaxWithRepartition {
  taxId: string
  taxCode: string
  taxName: string
  rate: number  // basis points (1000 = 10%)
  invoiceRepartitionLines: TaxRepartitionLine[]
  refundRepartitionLines: TaxRepartitionLine[]
}

export interface TaxRepartitionResult {
  base: number  // base amount in cents
  taxLines: Array<{
    accountId: string | null
    amount: number  // tax amount in cents
    factorPercent: number
    repartitionType: 'base' | 'tax'
    tagIds: string[]
  }>
  totalTax: number  // sum of all tax amounts
}

/**
 * Compute tax with repartition lines.
 *
 * For a $100 invoice with 10% tax split 60/40:
 *   base = 10000 cents
 *   state tax line = 10000 × 10% × 60% = 600 cents
 *   city tax line = 10000 × 10% × 40% = 400 cents
 *   total tax = 1000 cents
 */
export function computeTaxWithRepartition(
  baseCents: number,
  tax: TaxWithRepartition,
  isRefund: boolean = false,
): TaxRepartitionResult {
  const repartitionLines = isRefund
    ? tax.refundRepartitionLines
    : tax.invoiceRepartitionLines

  // Sort: base lines first, then tax lines
  const sortedLines = [...repartitionLines].sort((a, b) => {
    if (a.repartitionType === 'base' && b.repartitionType === 'tax') return -1
    if (a.repartitionType === 'tax' && b.repartitionType === 'base') return 1
    return 0
  })

  const taxLines: TaxRepartitionResult['taxLines'] = []
  let totalTax = 0
  const rate = tax.rate / 10000 // basis points to decimal

  for (const line of sortedLines) {
    if (line.repartitionType === 'base') {
      // Base line — no amount, just tagging
      taxLines.push({
        accountId: null,
        amount: 0,
        factorPercent: line.factorPercent,
        repartitionType: 'base',
        tagIds: line.tagIds,
      })
    } else if (line.repartitionType === 'tax') {
      // Tax line — compute portion of total tax
      const fullTaxAmount = Math.round(baseCents * rate)
      const lineAmount = Math.round(fullTaxAmount * (line.factorPercent / 100))
      totalTax += lineAmount

      taxLines.push({
        accountId: line.accountId,
        amount: lineAmount,
        factorPercent: line.factorPercent,
        repartitionType: 'tax',
        tagIds: line.tagIds,
      })
    }
  }

  return {
    base: baseCents,
    taxLines,
    totalTax,
  }
}

/**
 * Default repartition lines for a simple tax (100% to one account).
 * Most taxes have a simple structure: 1 base line + 1 tax line.
 */
export function createDefaultRepartition(
  taxId: string,
  accountId: string,
): {
  invoice: TaxRepartitionLine[]
  refund: TaxRepartitionLine[]
} {
  const baseLine: TaxRepartitionLine = {
    id: `${taxId}-base`,
    repartitionType: 'base',
    factorPercent: 100,
    accountId: null,
    documentType: 'invoice',
    tagIds: [],
  }

  const taxLine: TaxRepartitionLine = {
    id: `${taxId}-tax`,
    repartitionType: 'tax',
    factorPercent: 100,
    accountId,
    documentType: 'invoice',
    tagIds: [],
  }

  const refundBaseLine: TaxRepartitionLine = {
    ...baseLine,
    id: `${taxId}-base-refund`,
    documentType: 'refund',
  }

  const refundTaxLine: TaxRepartitionLine = {
    ...taxLine,
    id: `${taxId}-tax-refund`,
    documentType: 'refund',
  }

  return {
    invoice: [baseLine, taxLine],
    refund: [refundBaseLine, refundTaxLine],
  }
}

/**
 * Generate journal lines from tax repartition results.
 * For each tax line with an account, create a journal line:
 *   - For invoices (sales): credit the tax payable account
 *   - For bills (purchases): debit the tax receivable account
 */
export function generateRepartitionJournalLines(
  results: TaxRepartitionResult[],
  isSale: boolean,
): Array<{
  accountId: string
  debit: number
  credit: number
  description: string
}> {
  const journalLines: Array<{
    accountId: string
    debit: number
    credit: number
    description: string
  }> = []

  for (const result of results) {
    for (const line of result.taxLines) {
      if (line.repartitionType === 'tax' && line.accountId && line.amount > 0) {
        journalLines.push({
          accountId: line.accountId,
          debit: isSale ? 0 : line.amount,
          credit: isSale ? line.amount : 0,
          description: `Tax (${line.factorPercent}% portion)`,
        })
      }
    }
  }

  return journalLines
}
