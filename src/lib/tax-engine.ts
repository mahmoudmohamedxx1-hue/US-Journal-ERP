/**
 * US Journal ERP — Tax Computation Engine
 *
 * Inspired by Odoo's account_tax.py `compute_all()` method.
 *
 * Supports:
 *   - 'percent': tax = base * (amount / 100)
 *   - 'fixed': tax = amount * quantity
 *   - 'group': composition of sub-taxes (applied sequentially)
 *   - 'division': price-included tax (tax = base - base/(1+amount/100))
 *
 * Usage:
 *   import { computeTaxes } from '@/lib/tax-engine'
 *   const result = computeTaxes(100, 1, taxCodes, { isRefund: false, priceIncludesTax: false })
 *   // result.total_excluded = 100
 *   // result.total_included = 110 (if 10% tax)
 *   // result.taxes = [{ id, name, base: 100, amount: 10, ... }]
 */

import { db } from '@/lib/db'

export interface TaxCode {
  id: string
  code: string
  name: string
  rate: number          // stored as basis points (1500 = 15%)
  amountType: 'percent' | 'fixed' | 'group' | 'division'
  typeTaxUse: 'sale' | 'purchase' | 'none'
  priceInclude: boolean
  taxAccountPayableId?: string | null  // account to credit for collected sales tax
  taxAccountReceivableId?: string | null
  children?: TaxCode[]   // for group taxes
}

export interface TaxComputationResult {
  total_excluded: number  // amount before tax (in cents)
  total_included: number // amount after tax (in cents)
  total_void: number     // amount with taxes that have no account set
  taxes: Array<{
    id: string
    code: string
    name: string
    base: number          // base amount this tax applies to (cents)
    amount: number        // tax amount (cents)
    rate: number          // effective rate (e.g., 0.10 for 10%)
    account: string | null // payable account id
  }>
}

/**
 * Compute all taxes for a line item.
 *
 * @param priceUnit - unit price in MAJOR units (e.g., dollars, not cents)
 * @param quantity - quantity
 * @param taxCodes - array of TaxCode objects to apply
 * @param opts - { isRefund, priceIncludesTax }
 * @returns TaxComputationResult
 */
export function computeTaxes(
  priceUnit: number,
  quantity: number,
  taxCodes: TaxCode[],
  opts: { isRefund?: boolean; priceIncludesTax?: boolean } = {},
): TaxComputationResult {
  const { priceIncludesTax = false } = opts
  const baseRaw = priceUnit * quantity // in major units
  const baseCents = Math.round(baseRaw * 100) // convert to cents

  let total_excluded = baseCents
  let total_included = baseCents
  const taxes: TaxComputationResult['taxes'] = []

  // Sort by sequence (simplified: just iterate in order)
  for (const tax of taxCodes) {
    if (tax.amountType === 'group' && tax.children && tax.children.length > 0) {
      // For group taxes, compute each child tax
      const childResult = computeTaxes(priceUnit, quantity, tax.children, opts)
      taxes.push(...childResult.taxes)
      total_included += childResult.taxes.reduce((s, t) => s + t.amount, 0)
      continue
    }

    let taxAmountCents = 0
    const rate = tax.rate / 10000 // basis points to decimal (1500 → 0.15)

    switch (tax.amountType) {
      case 'percent':
        if (priceIncludesTax) {
          // Tax is included in the price — extract it
          // base = total / (1 + rate)
          // tax = total - base
          const baseExcl = Math.round(baseCents / (1 + rate))
          taxAmountCents = baseCents - baseExcl
          total_excluded = baseExcl
        } else {
          // Tax is added on top
          taxAmountCents = Math.round(baseCents * rate)
          total_included += taxAmountCents
        }
        break

      case 'fixed':
        // Fixed amount per unit
        taxAmountCents = Math.round(tax.rate / 100 * quantity) // rate in cents per unit
        if (priceIncludesTax) {
          total_excluded -= taxAmountCents
        } else {
          total_included += taxAmountCents
        }
        break

      case 'division':
        // Price-included tax (e.g., VAT in EU)
        // tax = base - base / (1 + rate)
        taxAmountCents = Math.round(baseCents - baseCents / (1 + rate))
        if (!priceIncludesTax) {
          total_included += taxAmountCents
        }
        break

      default:
        taxAmountCents = 0
    }

    taxes.push({
      id: tax.id,
      code: tax.code,
      name: tax.name,
      base: priceIncludesTax ? total_excluded : baseCents,
      amount: taxAmountCents,
      rate,
      account: tax.taxAccountPayableId || null,
    })
  }

  const total_void = taxes
    .filter(t => !t.account)
    .reduce((s, t) => s + t.amount, 0)

  return {
    total_excluded,
    total_included,
    total_void,
    taxes,
  }
}

/**
 * Load tax codes from the database by their IDs or codes.
 */
export async function loadTaxCodes(
  organizationId: string,
  taxIds?: string[],
  taxCodes?: string[],
): Promise<TaxCode[]> {
  const where: Record<string, unknown> = { organizationId }
  if (taxIds && taxIds.length > 0) {
    where.id = { in: taxIds }
  }
  // TaxCode model doesn't have a 'code' field — use 'name' or 'id'
  const dbTaxCodes = await db.taxCode.findMany({ where })

  return dbTaxCodes.map(tc => ({
    id: tc.id,
    code: tc.code || tc.name,
    name: tc.name,
    rate: tc.rate,  // stored as basis points
    amountType: 'percent' as const,  // simplified — all taxes are percent for now
    typeTaxUse: (tc.type as 'sale' | 'purchase' | 'none') || 'sale',
    priceInclude: tc.priceInclude || false,
    taxAccountPayableId: tc.payableAccountId,
    taxAccountReceivableId: tc.receivableAccountId,
  }))
}

/**
 * Generate journal lines for tax amounts.
 * For each tax, create a line that:
 *   - Debits the tax receivable account (for purchases)
 *   - Credits the tax payable account (for sales)
 *
 * Returns an array of { accountId, debit, credit, description } entries
 * that can be appended to a journal's lines array.
 */
export function generateTaxJournalLines(
  taxes: TaxComputationResult['taxes'],
  isSale: boolean,
): Array<{ accountId: string | null; debit: number; credit: number; description: string }> {
  return taxes.map(tax => ({
    accountId: isSale ? tax.account : tax.account, // same account for both — direction differs
    debit: isSale ? 0 : tax.amount,
    credit: isSale ? tax.amount : 0,
    description: `Tax: ${tax.name} (${(tax.rate * 100).toFixed(2)}%)`,
  }))
}
