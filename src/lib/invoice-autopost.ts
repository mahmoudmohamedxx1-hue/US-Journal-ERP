/**
 * US Journal ERP — Invoice Auto-Post Engine
 *
 * Inspired by Odoo's account_move.py `_post()` + `_sync_dynamic_lines()`.
 *
 * In Odoo, when you post an invoice, it automatically creates the journal entry
 * with balanced lines:
 *   - Debit Accounts Receivable (asset) for the total
 *   - Credit Revenue for the subtotal
 *   - Credit Tax Payable for each tax
 *
 * This module does the same: takes an invoice and creates a Posted journal entry.
 */

import { db } from '@/lib/db'
import { logAudit } from '@/lib/api'

export interface AutoPostResult {
  journalId: string
  journalNumber: string
  linesCreated: number
  totalDebit: number
  totalCredit: number
}

/**
 * Auto-create a Posted journal entry from an invoice.
 *
 * This is Odoo's `action_post()` equivalent for invoices.
 *
 * Journal entry structure:
 *   Line 1: Debit AR account (1120) for invoice total
 *   Line 2: Credit Revenue account (4xxx) for subtotal (amount - tax)
 *   Line 3+: Credit Tax Payable (2130) for each tax
 *
 * @param invoiceId - the invoice to post
 * @param ctx - { organizationId, userId }
 */
export async function autoPostInvoice(
  invoiceId: string,
  ctx: { organizationId: string; userId: string },
): Promise<AutoPostResult> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      lines: { include: { product: true, taxCode: true } },
    },
  })
  if (!invoice) throw new Error('Invoice not found')
  if (invoice.status === 'Paid') throw new Error('Cannot post a Paid invoice')

  // Find the AR account (1120 — Accounts Receivable)
  const arAccount = await db.account.findFirst({
    where: { organizationId: ctx.organizationId, code: '1120' },
  })
  if (!arAccount) throw new Error('Accounts Receivable account (1120) not found')

  // Find the Sales Tax Payable account (2130)
  const taxPayableAccount = await db.account.findFirst({
    where: { organizationId: ctx.organizationId, code: '2130' },
  })

  // Calculate totals from invoice lines
  let subtotal = 0
  let taxTotal = 0
  const revenueByAccount: Record<string, number> = {}

  for (const line of invoice.lines) {
    const lineAmount = line.quantity * line.unitPrice // in cents
    subtotal += lineAmount

    // Determine revenue account from product or default to 4100
    let revenueAccountCode = '4100'
    if (line.product) {
      // Try to find a revenue account based on product category
      revenueAccountCode = '4100' // simplified
    }
    if (!revenueByAccount[revenueAccountCode]) {
      revenueByAccount[revenueAccountCode] = 0
    }
    revenueByAccount[revenueAccountCode] += lineAmount

    // Calculate tax if tax code is set
    if (line.taxCodeId && line.taxCode) {
      const taxAmount = Math.round(lineAmount * line.taxCode.rate / 10000)
      taxTotal += taxAmount
    }
  }

  // If no lines, use invoice.amount
  if (invoice.lines.length === 0) {
    subtotal = invoice.amount - 0 // no tax breakdown for simple invoices
    revenueByAccount['4100'] = subtotal
  }

  const total = subtotal + taxTotal

  // Find fiscal period for invoice date
  const invDate = new Date(invoice.invoiceDate)
  const fiscalYear = await db.fiscalYear.findFirst({
    where: { organizationId: ctx.organizationId, startDate: { lte: invDate }, endDate: { gte: invDate } },
  })
  let periodId: string | null = null
  if (fiscalYear) {
    const period = await db.fiscalPeriod.findFirst({
      where: { fiscalYearId: fiscalYear.id, startDate: { lte: invDate }, endDate: { gte: invDate } },
    })
    if (period) {
      if (period.status === 'Closed') throw new Error(`Cannot post into closed fiscal period: ${period.name}`)
      periodId = period.id
    }
  }

  // Generate journal number
  const count = await db.journal.count({ where: { organizationId: ctx.organizationId } })
  const journalNumber = `JE-${invDate.getFullYear()}-${String(count + 1).padStart(4, '0')}`

  // Create the journal entry with lines
  const journal = await db.$transaction(async (tx) => {
    // Line 1: Debit AR
    const journalLines: Array<{
      lineNumber: number
      accountId: string
      description: string
      debit: number
      credit: number
    }> = []

    let lineNum = 1

    // Debit AR for the full total (subtotal + tax)
    journalLines.push({
      lineNumber: lineNum++,
      accountId: arAccount.id,
      description: `AR — ${invoice.customer?.name || 'Customer'} — ${invoice.invoiceNumber}`,
      debit: total,
      credit: 0,
    })

    // Credit Revenue accounts
    for (const [accountCode, amount] of Object.entries(revenueByAccount)) {
      const revenueAccount = await tx.account.findFirst({
        where: { organizationId: ctx.organizationId, code: accountCode },
      })
      if (revenueAccount && amount > 0) {
        journalLines.push({
          lineNumber: lineNum++,
          accountId: revenueAccount.id,
          description: `Revenue — ${invoice.invoiceNumber}`,
          debit: 0,
          credit: amount,
        })
      }
    }

    // Credit Tax Payable
    if (taxTotal > 0 && taxPayableAccount) {
      journalLines.push({
        lineNumber: lineNum++,
        accountId: taxPayableAccount.id,
        description: `Sales Tax — ${invoice.invoiceNumber}`,
        debit: 0,
        credit: taxTotal,
      })
    }

    const j = await tx.journal.create({
      data: {
        organizationId: ctx.organizationId,
        journalNumber,
        journalDate: invDate,
        fiscalPeriodId: periodId,
        source: 'AR',
        reference: invoice.invoiceNumber,
        description: `Invoice ${invoice.invoiceNumber} — ${invoice.customer?.name || ''}`,
        currency: invoice.currency,
        exchangeRate: 100,
        status: 'Posted',
        totalDebit: total,
        totalCredit: total,
        createdById: ctx.userId,
        postedById: ctx.userId,
        postedAt: new Date(),
        postingDate: new Date(),
      },
    })

    // Create all lines
    for (const line of journalLines) {
      await tx.journalLine.create({
        data: {
          journalId: j.id,
          lineNumber: line.lineNumber,
          accountId: line.accountId,
          description: line.description,
          debit: line.debit,
          credit: line.credit,
        },
      })
    }

    // Link invoice to journal
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: 'Posted' },
    })

    // Compute and store hash (Odoo's inalterable_hash pattern)
    await computeAndStoreJournalHash(tx, j.id, ctx.organizationId)

    return j
  })

  await logAudit({
    action: 'AUTO_POST_INVOICE',
    entityType: 'Journal',
    entityId: journal.id,
    description: `Auto-posted invoice ${invoice.invoiceNumber} → journal ${journalNumber} (${Object.keys(revenueByAccount).length} revenue lines + ${taxTotal > 0 ? '1 tax line' : '0 tax lines'})`,
    userId: ctx.userId,
    organizationId: ctx.organizationId,
  })

  return {
    journalId: journal.id,
    journalNumber,
    linesCreated: 0, // will be set by caller
    totalDebit: total,
    totalCredit: total,
  }
}

/**
 * Same for bills (vendor invoices):
 *   Line 1: Credit AP account (2000/2110) for bill total
 *   Line 2: Debit Expense account for subtotal
 *   Line 3+: Debit Tax Receivable for each tax
 */
export async function autoPostBill(
  billId: string,
  ctx: { organizationId: string; userId: string },
): Promise<AutoPostResult> {
  const bill = await db.bill.findUnique({
    where: { id: billId },
    include: { vendor: true, lines: { include: { product: true, taxCode: true } } },
  })
  if (!bill) throw new Error('Bill not found')
  if (bill.status === 'Paid') throw new Error('Cannot post a Paid bill')

  const apAccount = await db.account.findFirst({
    where: { organizationId: ctx.organizationId, code: '2110' },
  })
  if (!apAccount) throw new Error('Accounts Payable account (2110) not found')

  const taxReceivableAccount = await db.account.findFirst({
    where: { organizationId: ctx.organizationId, code: '1160' },
  })

  let subtotal = 0
  let taxTotal = 0
  const expenseByAccount: Record<string, number> = {}

  for (const line of bill.lines) {
    const lineAmount = line.quantity * line.unitPrice
    subtotal += lineAmount
    const expCode = '6400' // default to Office Supplies
    if (!expenseByAccount[expCode]) expenseByAccount[expCode] = 0
    expenseByAccount[expCode] += lineAmount
    if (line.taxCodeId && line.taxCode) {
      taxTotal += Math.round(lineAmount * line.taxCode.rate / 10000)
    }
  }

  if (bill.lines.length === 0) {
    subtotal = bill.amount
    expenseByAccount['6400'] = subtotal
  }

  const total = subtotal + taxTotal
  const billDate = new Date(bill.billDate)
  const fiscalYear = await db.fiscalYear.findFirst({
    where: { organizationId: ctx.organizationId, startDate: { lte: billDate }, endDate: { gte: billDate } },
  })
  let periodId: string | null = null
  if (fiscalYear) {
    const period = await db.fiscalPeriod.findFirst({
      where: { fiscalYearId: fiscalYear.id, startDate: { lte: billDate }, endDate: { gte: billDate } },
    })
    if (period) {
      if (period.status === 'Closed') throw new Error(`Cannot post into closed fiscal period: ${period.name}`)
      periodId = period.id
    }
  }

  const count = await db.journal.count({ where: { organizationId: ctx.organizationId } })
  const journalNumber = `JE-${billDate.getFullYear()}-${String(count + 1).padStart(4, '0')}`

  const journal = await db.$transaction(async (tx) => {
    const journalLines: Array<{ lineNumber: number; accountId: string; description: string; debit: number; credit: number }> = []
    let lineNum = 1

    // Debit Expense accounts
    for (const [accountCode, amount] of Object.entries(expenseByAccount)) {
      const expAccount = await tx.account.findFirst({
        where: { organizationId: ctx.organizationId, code: accountCode },
      })
      if (expAccount && amount > 0) {
        journalLines.push({
          lineNumber: lineNum++,
          accountId: expAccount.id,
          description: `Expense — ${bill.billNumber}`,
          debit: amount,
          credit: 0,
        })
      }
    }

    // Debit Tax Receivable
    if (taxTotal > 0 && taxReceivableAccount) {
      journalLines.push({
        lineNumber: lineNum++,
        accountId: taxReceivableAccount.id,
        description: `Input Tax — ${bill.billNumber}`,
        debit: taxTotal,
        credit: 0,
      })
    }

    // Credit AP
    journalLines.push({
      lineNumber: lineNum++,
      accountId: apAccount.id,
      description: `AP — ${bill.vendor?.name || 'Vendor'} — ${bill.billNumber}`,
      debit: 0,
      credit: total,
    })

    const j = await tx.journal.create({
      data: {
        organizationId: ctx.organizationId,
        journalNumber,
        journalDate: billDate,
        fiscalPeriodId: periodId,
        source: 'AP',
        reference: bill.billNumber,
        description: `Bill ${bill.billNumber} — ${bill.vendor?.name || ''}`,
        currency: bill.currency,
        exchangeRate: 100,
        status: 'Posted',
        totalDebit: total,
        totalCredit: total,
        createdById: ctx.userId,
        postedById: ctx.userId,
        postedAt: new Date(),
        postingDate: new Date(),
      },
    })

    for (const line of journalLines) {
      await tx.journalLine.create({
        data: {
          journalId: j.id,
          lineNumber: line.lineNumber,
          accountId: line.accountId,
          description: line.description,
          debit: line.debit,
          credit: line.credit,
        },
      })
    }

    await tx.bill.update({ where: { id: billId }, data: { status: 'Posted' } })
    await computeAndStoreJournalHash(tx, j.id, ctx.organizationId)
    return j
  })

  await logAudit({
    action: 'AUTO_POST_BILL',
    entityType: 'Journal',
    entityId: journal.id,
    description: `Auto-posted bill ${bill.billNumber} → journal ${journalNumber}`,
    userId: ctx.userId,
    organizationId: ctx.organizationId,
  })

  return { journalId: journal.id, journalNumber, linesCreated: 0, totalDebit: total, totalCredit: total }
}

/**
 * Odoo's inalterable_hash pattern.
 * Computes SHA-256 hash of journal entry, chained to the previous posted journal's hash.
 * This makes the journal entry tamper-proof — any modification breaks the chain.
 */
export async function computeAndStoreJournalHash(
  tx: any,
  journalId: string,
  organizationId: string,
): Promise<string | null> {
  try {
    const journal = await tx.journal.findUnique({
      where: { id: journalId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })
    if (!journal || journal.status !== 'Posted') return null

    // Get the previous posted journal's hash (Odoo chains hashes)
    const prevJournal = await tx.journal.findFirst({
      where: {
        organizationId,
        status: 'Posted',
        id: { not: journalId },
        journalDate: { lte: journal.journalDate },
        inalterableHash: { not: null },
      },
      orderBy: { postedAt: 'desc' },
    })
    const prevHash = prevJournal?.inalterableHash || ''

    // Build hash content: journal fields + all line fields
    const hashFields = {
      id: journal.id,
      journalNumber: journal.journalNumber,
      journalDate: journal.journalDate.toISOString(),
      source: journal.source,
      reference: journal.reference || '',
      description: journal.description || '',
      totalDebit: journal.totalDebit,
      totalCredit: journal.totalCredit,
      currency: journal.currency,
      prevHash,
      lines: journal.lines.map(l => ({
        lineNumber: l.lineNumber,
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        description: l.description || '',
      })),
    }

    const crypto = await import('crypto')
    const content = JSON.stringify(hashFields, Object.keys(hashFields).sort())
    const hash = crypto.createHash('sha256').update(content).digest('hex')

    await tx.journal.update({
      where: { id: journalId },
      data: { inalterableHash: hash },
    })

    return hash
  } catch (e) {
    console.error('[hash] Failed to compute journal hash:', e)
    return null
  }
}

/**
 * Verify the hash chain integrity of all posted journals.
 * Returns list of broken entries (tampered or missing hash).
 */
export async function verifyJournalHashChain(organizationId: string): Promise<{
  total: number
  hashed: number
  broken: Array<{ journalId: string; journalNumber: string; reason: string }>
}> {
  const journals = await db.journal.findMany({
    where: { organizationId, status: 'Posted' },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
    orderBy: { postedAt: 'asc' },
  })

  let prevHash = ''
  const broken: Array<{ journalId: string; journalNumber: string; reason: string }> = []
  let hashed = 0

  for (const journal of journals) {
    if (!journal.inalterableHash) {
      broken.push({ journalId: journal.id, journalNumber: journal.journalNumber, reason: 'Missing hash' })
      continue
    }

    // Recompute hash and compare
    const hashFields = {
      id: journal.id,
      journalNumber: journal.journalNumber,
      journalDate: journal.journalDate.toISOString(),
      source: journal.source,
      reference: journal.reference || '',
      description: journal.description || '',
      totalDebit: journal.totalDebit,
      totalCredit: journal.totalCredit,
      currency: journal.currency,
      prevHash,
      lines: journal.lines.map(l => ({
        lineNumber: l.lineNumber,
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        description: l.description || '',
      })),
    }

    const crypto = await import('crypto')
    const content = JSON.stringify(hashFields, Object.keys(hashFields).sort())
    const expectedHash = crypto.createHash('sha256').update(content).digest('hex')

    if (expectedHash !== journal.inalterableHash) {
      broken.push({
        journalId: journal.id,
        journalNumber: journal.journalNumber,
        reason: 'Hash mismatch — entry may have been tampered with',
      })
    } else {
      hashed++
    }

    prevHash = journal.inalterableHash
  }

  return { total: journals.length, hashed, broken }
}
