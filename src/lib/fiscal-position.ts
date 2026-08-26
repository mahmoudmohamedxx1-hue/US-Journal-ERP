/**
 * US Journal ERP — Fiscal Positions Engine
 *
 * Inspired by Odoo's account_fiscal_position.
 *
 * Fiscal positions map taxes and accounts based on the partner's country/state.
 * For example:
 *   - Domestic customer: charge 14% VAT
 *   - EU customer (B2B, reverse charge): no VAT, map to reverse charge account
 *   - Export customer (outside EU): no VAT, zero-rated
 *
 * Rules:
 *   - If partner's country matches → apply this fiscal position
 *   - Tax mapping: replace tax A with tax B
 *   - Account mapping: replace account X with account Y
 */

import { db } from '@/lib/db'

export interface FiscalPosition {
  id: string
  name: string
  active: boolean
  countryFrom?: string  // if set, only applies when org is in this country
  countryTo?: string    // if set, only applies when partner is in this country
  zipFrom?: string
  zipTo?: string
  taxMappings: Array<{
    fromTaxCodeId: string
    toTaxCodeId: string | null  // null = remove tax (zero-rate)
  }>
  accountMappings: Array<{
    fromAccountId: string
    toAccountId: string
  }>
}

/**
 * Determine the applicable fiscal position for a partner.
 *
 * Odoo checks: partner's country, state, zip code vs fiscal position rules.
 *
 * Simplified: just check country.
 */
export async function getFiscalPosition(
  organizationId: string,
  partnerCountry?: string,
): Promise<FiscalPosition | null> {
  if (!partnerCountry) return null

  // In our system, fiscal positions are stored as CustomField records
  // (simplified — in a full Odoo migration, we'd have a FiscalPosition model)
  // For now, return a rule-based position
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { baseCurrency: true },
  })

  const orgCountry = org?.baseCurrency === 'USD' ? 'US' : 'EG'

  // If partner is in same country as org → domestic (no fiscal position needed)
  if (partnerCountry === orgCountry) return null

  // If partner is in a different country → export (zero-rated)
  const exportTaxCode = await db.taxCode.findFirst({
    where: { organizationId, rate: 0 },
  })

  if (!exportTaxCode) return null

  // Find the standard tax to replace
  const stdTax = await db.taxCode.findFirst({
    where: { organizationId, rate: { not: 0 } },
  })

  if (!stdTax) return null

  return {
    id: 'export-fp',
    name: `Export Position ( Partner Country: ${partnerCountry} )`,
    active: true,
    countryFrom: orgCountry,
    countryTo: partnerCountry,
    taxMappings: [
      { fromTaxCodeId: stdTax.id, toTaxCodeId: exportTaxCode.id },
    ],
    accountMappings: [],
  }
}

/**
 * Apply fiscal position to a set of tax codes.
 * Replaces taxes according to the fiscal position's tax mappings.
 */
export function applyTaxMapping(
  taxCodeIds: string[],
  fiscalPosition: FiscalPosition | null,
): string[] {
  if (!fiscalPosition) return taxCodeIds

  return taxCodeIds.map(taxId => {
    for (const mapping of fiscalPosition.taxMappings) {
      if (mapping.fromTaxCodeId === taxId) {
        return mapping.toTaxCodeId || taxId // null = keep original (zero-rate)
      }
    }
    return taxId
  })
}

/**
 * Apply fiscal position to an account.
 * Replaces the account according to the fiscal position's account mappings.
 */
export function applyAccountMapping(
  accountId: string,
  fiscalPosition: FiscalPosition | null,
): string {
  if (!fiscalPosition) return accountId

  for (const mapping of fiscalPosition.accountMappings) {
    if (mapping.fromAccountId === accountId) {
      return mapping.toAccountId
    }
  }

  return accountId
}
