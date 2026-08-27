/**
 * US Journal ERP — Currency Revaluation Engine
 *
 * Inspired by Odoo's account_move currency revaluation.
 *
 * At period end, open foreign-currency invoices/bills must be revalued
 * at the current exchange rate. The difference creates an FX gain/loss journal entry.
 *
 * Odoo creates:
 *   - For AR (asset, debit-normal):
 *     - Rate goes UP → receivable worth MORE in base currency → FX GAIN
 *     - Rate goes DOWN → receivable worth LESS → FX LOSS
 *   - For AP (liability, credit-normal):
 *     - Rate goes UP → payable worth MORE → FX LOSS
 *     - Rate goes DOWN → payable worth LESS → FX GAIN
 */

import { db } from '@/lib/db'
import { logAudit } from '@/lib/api'

export interface RevaluationItem {
  type: 'invoice' | 'bill'
  number: string
  partyName: string
  foreignCurrency: string
  foreignAmount: number    // in foreign currency cents
  originalRate: number      // original exchange rate
  currentRate: number       // current exchange rate
  baseAmountOriginal: number  // foreignAmount × originalRate (cents)
  baseAmountCurrent: number   // foreignAmount × currentRate (cents)
  gainLoss: number          // positive = gain, negative = loss (cents)
  isGain: boolean
}

export interface RevaluationResult {
  itemsProcessed: number
  totalGainLoss: number  // net gain (positive) or loss (negative)
  journalCreated: boolean
  journalNumber?: string
  gainAccountCode: string  // FX gain account (4220)
  lossAccountCode: string // FX loss account (7200)
  items: RevaluationItem[]
}

/**
 * Run currency revaluation for all open foreign-currency invoices/bills.
 *
 * Odoo's approach:
 *   1. Find all open (unpaid) invoices/bills in foreign currency
 *   2. Get current exchange rate
 *   3. Compute: base_amount_original = foreign_amount × original_rate
 *                base_amount_current = foreign_amount × current_rate
 *                gain_loss = base_amount_current - base_amount_original
 *   4. Create journal entry:
 *      - For invoices (AR): Dr/Cr AR account with gain/loss, Cr/Dr FX gain/loss account
 *      - For bills (AP): Dr/Cr AP account with gain/loss, Dr/Cr FX gain/loss account
 */
export async function runCurrencyRevaluation(
  organizationId: string,
  userId: string,
  revaluationDate: string,
  baseCurrency: string = 'USD',
): Promise<RevaluationResult> {
  // Find all open foreign-currency invoices
  const openInvoices = await db.invoice.findMany({
    where: {
      organizationId,
      status: { in: ['Open', 'Partially Paid', 'Overdue'] },
      currency: { not: baseCurrency },
    },
    include: { customer: true },
  })

  // Find all open foreign-currency bills
  const openBills = await db.bill.findMany({
    where: {
      organizationId,
      status: { in: ['Open', 'Partially Paid', 'Overdue'] },
      currency: { not: baseCurrency },
    },
    include: { vendor: true },
  })

  // Get current exchange rates
  const exchangeRates = await db.exchangeRate.findMany({
    where: { organizationId, toCurrency: baseCurrency },
    orderBy: { date: 'desc' },
  })

  const items: RevaluationItem[] = []
  let totalGainLoss = 0

  // Process invoices (AR — debit-normal asset)
  for (const inv of openInvoices) {
    const rate = exchangeRates.find(r => r.fromCurrency === inv.currency)
    const currentRate = rate ? rate.rate : 1.0
    const originalRate = inv.exchangeRate || currentRate

    const foreignAmount = inv.amount - inv.amountPaid // outstanding in foreign cents
    if (foreignAmount <= 0) continue

    const baseAmountOriginal = Math.round(foreignAmount * originalRate / 100)
    const baseAmountCurrent = Math.round(foreignAmount * currentRate / 100)
    const gainLoss = baseAmountCurrent - baseAmountOriginal

    // For AR: rate UP = gain (receivable worth more), rate DOWN = loss
    items.push({
      type: 'invoice',
      number: inv.invoiceNumber,
      partyName: inv.customer?.name || 'Unknown',
      foreignCurrency: inv.currency,
      foreignAmount,
      originalRate,
      currentRate,
      baseAmountOriginal,
      baseAmountCurrent,
      gainLoss,
      isGain: gainLoss >= 0,
    })
    totalGainLoss += gainLoss
  }

  // Process bills (AP — credit-normal liability)
  for (const bill of openBills) {
    const rate = exchangeRates.find(r => r.fromCurrency === bill.currency)
    const currentRate = rate ? rate.rate : 1.0
    const originalRate = bill.exchangeRate || currentRate

    const foreignAmount = bill.amount - bill.amountPaid
    if (foreignAmount <= 0) continue

    const baseAmountOriginal = Math.round(foreignAmount * originalRate / 100)
    const baseAmountCurrent = Math.round(foreignAmount * currentRate / 100)
    // For AP: rate UP = loss (payable worth more), rate DOWN = gain
    // So gain/loss is REVERSED compared to AR
    const gainLoss = -(baseAmountCurrent - baseAmountOriginal)

    items.push({
      type: 'bill',
      number: bill.billNumber,
      partyName: bill.vendor?.name || 'Unknown',
      foreignCurrency: bill.currency,
      foreignAmount,
      originalRate,
      currentRate,
      baseAmountOriginal,
      baseAmountCurrent,
      gainLoss,
      isGain: gainLoss >= 0,
    })
    totalGainLoss += gainLoss
  }

  if (items.length === 0) {
    return {
      itemsProcessed: 0,
      totalGainLoss: 0,
      journalCreated: false,
      gainAccountCode: '4220',
      lossAccountCode: '7200',
      items: [],
    }
  }

  // Find FX gain and loss accounts
  const fxGainAccount = await db.account.findFirst({
    where: { organizationId, code: '4220' }, // Foreign Exchange Gain
  })
  const fxLossAccount = await db.account.findFirst({
    where: { organizationId, code: '7200' }, // Foreign Exchange Loss
  })
  const arAccount = await db.account.findFirst({
    where: { organizationId, code: '1120' },
  })
  const apAccount = await db.account.findFirst({
    where: { organizationId, code: '2110' },
  })

  if (!fxGainAccount || !fxLossAccount || !arAccount || !apAccount) {
    throw new Error('Required accounts not found: FX gain (4220), FX loss (7200), AR (1120), AP (2110)')
  }

  // Create the revaluation journal entry
  const revDate = new Date(revaluationDate)
  const count = await db.journal.count({ where: { organizationId } })
  const journalNumber = `JE-${revDate.getFullYear()}-${String(count + 1).padStart(4, '0')}`

  // Aggregate by gain/loss
  const totalGain = items.filter(i => i.isGain).reduce((s, i) => s + i.gainLoss, 0)
  const totalLoss = items.filter(i => !i.isGain).reduce((s, i) => s + Math.abs(i.gainLoss), 0)

  const journal = await db.$transaction(async (tx) => {
    let lineNum = 1
    const journalLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = []

    // AR revaluation: for each invoice, adjust AR account
    for (const item of items.filter(i => i.type === 'invoice')) {
      if (item.gainLoss === 0) continue
      if (item.isGain) {
        // FX gain on AR: debit AR (increase), credit FX gain
        journalLines.push({ accountId: arAccount.id, description: `FX revaluation — ${item.number}`, debit: item.gainLoss, credit: 0 })
        journalLines.push({ accountId: fxGainAccount.id, description: `FX gain — ${item.number}`, debit: 0, credit: item.gainLoss })
      } else {
        // FX loss on AR: credit AR (decrease), debit FX loss
        journalLines.push({ accountId: fxLossAccount.id, description: `FX loss — ${item.number}`, debit: Math.abs(item.gainLoss), credit: 0 })
        journalLines.push({ accountId: arAccount.id, description: `FX revaluation — ${item.number}`, debit: 0, credit: Math.abs(item.gainLoss) })
      }
    }

    // AP revaluation: for each bill, adjust AP account
    for (const item of items.filter(i => i.type === 'bill')) {
      if (item.gainLoss === 0) continue
      if (item.isGain) {
        // FX gain on AP: debit AP (decrease), credit FX gain
        journalLines.push({ accountId: apAccount.id, description: `FX revaluation — ${item.number}`, debit: Math.abs(item.gainLoss), credit: 0 })
        journalLines.push({ accountId: fxGainAccount.id, description: `FX gain — ${item.number}`, debit: 0, credit: Math.abs(item.gainLoss) })
      } else {
        // FX loss on AP: debit FX loss, credit AP (increase)
        journalLines.push({ accountId: fxLossAccount.id, description: `FX loss — ${item.number}`, debit: Math.abs(item.gainLoss), credit: 0 })
        journalLines.push({ accountId: apAccount.id, description: `FX revaluation — ${item.number}`, debit: 0, credit: Math.abs(item.gainLoss) })
      }
    }

    // Calculate totals
    const totalDebit = journalLines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = journalLines.reduce((s, l) => s + l.credit, 0)

    const j = await tx.journal.create({
      data: {
        organizationId,
        journalNumber,
        journalDate: revDate,
        source: 'FX Revaluation',
        reference: `FX-REV-${revaluationDate}`,
        description: `Currency revaluation as of ${revaluationDate} — ${items.length} items, gain: ${totalGain}, loss: ${totalLoss}`,
        currency: baseCurrency,
        exchangeRate: 100,
        status: 'Posted',
        totalDebit,
        totalCredit,
        createdById: userId,
        postedById: userId,
        postedAt: new Date(),
        postingDate: new Date(),
      },
    })

    for (const line of journalLines) {
      await tx.journalLine.create({
        data: {
          journalId: j.id,
          lineNumber: lineNum++,
          accountId: line.accountId,
          description: line.description,
          debit: line.debit,
          credit: line.credit,
        },
      })
    }

    return j
  })

  await logAudit({
    action: 'FX_REVALUATION',
    entityType: 'Journal',
    entityId: journal.id,
    description: `Currency revaluation: ${items.length} items processed, net ${totalGainLoss >= 0 ? 'gain' : 'loss'} ${Math.abs(totalGainLoss)} cents`,
    userId,
    organizationId,
  })

  return {
    itemsProcessed: items.length,
    totalGainLoss,
    journalCreated: true,
    journalNumber,
    gainAccountCode: '4220',
    lossAccountCode: '7200',
    items,
  }
}
