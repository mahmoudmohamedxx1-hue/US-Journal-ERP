import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext, logAudit } from '@/lib/api'

// POST /api/fx-revaluation — create FX revaluation journals
// For each open invoice/bill in a foreign currency, calculate the FX gain/loss
// using the current exchange rate and create a journal entry
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { revaluationDate, targetCurrency } = body

    if (!revaluationDate) return err('revaluationDate is required', 422, undefined, 'VALIDATION_ERROR')
    const revDate = new Date(revaluationDate)

    // Fetch org's base currency (fallback to USD if not set)
    const org = await db.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { baseCurrency: true, currency: true },
    })
    const baseCurrency = targetCurrency || org?.baseCurrency || org?.currency || 'USD'

    // Get all foreign-currency invoices (not EGP)
    const invoices = await db.invoice.findMany({
      where: { organizationId: ctx.organizationId, currency: { not: baseCurrency }, status: { in: ['Open', 'Partially Paid', 'Overdue'] } },
    })
    const bills = await db.bill.findMany({
      where: { organizationId: ctx.organizationId, currency: { not: baseCurrency }, status: { in: ['Open', 'Partially Paid', 'Overdue'] } },
    })

    // Get latest exchange rates
    const rates = await db.exchangeRate.findMany({
      where: { organizationId: ctx.organizationId, toCurrency: baseCurrency },
      orderBy: { date: 'desc' },
    })

    const rateMap = new Map<string, number>()
    for (const r of rates) {
      if (!rateMap.has(r.fromCurrency)) rateMap.set(r.fromCurrency, r.rate)
    }

    const results: Array<{ type: string; number: string; currency: string; amount: number; rate: number; baseAmount: number; fxGainLoss: number }> = []

    // Process invoices (AR — gain if rate increases, loss if decreases)
    for (const inv of invoices) {
      const rate = rateMap.get(inv.currency) || 100 // default 1:1
      const currentBaseAmount = Math.round(inv.amount * rate / 100)
      // Simple revaluation: compare current base amount vs original
      const originalBaseAmount = inv.amount // simplified — in production, store original rate
      const fxGainLoss = currentBaseAmount - originalBaseAmount
      results.push({
        type: 'INVOICE',
        number: inv.invoiceNumber,
        currency: inv.currency,
        amount: inv.amount,
        rate: rate / 100,
        baseAmount: currentBaseAmount,
        fxGainLoss,
      })
    }

    // Process bills (AP — opposite direction)
    for (const bill of bills) {
      const rate = rateMap.get(bill.currency) || 100
      const currentBaseAmount = Math.round(bill.amount * rate / 100)
      const fxGainLoss = currentBaseAmount - bill.amount
      results.push({
        type: 'BILL',
        number: bill.billNumber,
        currency: bill.currency,
        amount: bill.amount,
        rate: rate / 100,
        baseAmount: currentBaseAmount,
        fxGainLoss,
      })
    }

    // Create a revaluation journal if there are FX differences
    const totalGainLoss = results.reduce((s, r) => s + r.fxGainLoss, 0)
    let journalCreated = false

    if (Math.abs(totalGainLoss) > 1 && results.length > 0) {
      // Find FX gain/loss accounts (7000-series — Other Expenses)
      const fxAccount = await db.account.findFirst({
        where: { organizationId: ctx.organizationId, code: { startsWith: '72' } },
      }) || await db.account.findFirst({
        where: { organizationId: ctx.organizationId, accountType: 'Expense' },
      })

      const arAccount = await db.account.findFirst({
        where: { organizationId: ctx.organizationId, code: '1120' },
      }) || await db.account.findFirst({
        where: { organizationId: ctx.organizationId, accountType: 'Asset' },
      })

      if (fxAccount && arAccount) {
        const count = await db.journal.count({ where: { organizationId: ctx.organizationId } })
        const journalNumber = `JE-${revDate.getFullYear()}-${String(count + 1).padStart(4, '0')}`

        await db.journal.create({
          data: {
            organizationId: ctx.organizationId,
            journalNumber,
            journalDate: revDate,
            source: 'FX Revaluation',
            reference: `FX-REV-${revDate.toISOString().slice(0, 10)}`,
            description: `FX revaluation as of ${revDate.toISOString().slice(0, 10)}`,
            currency: baseCurrency,
            exchangeRate: 100,
            status: 'Posted',
            totalDebit: totalGainLoss > 0 ? totalGainLoss : 0,
            totalCredit: totalGainLoss > 0 ? 0 : Math.abs(totalGainLoss),
            createdById: ctx.userId,
            postedById: ctx.userId,
            postedAt: new Date(),
            postingDate: new Date(),
          },
        })
        await db.journalLine.createMany({
          data: [
            { journalId: (await db.journal.findFirst({ where: { journalNumber }, orderBy: { createdAt: 'desc' } }))!.id, lineNumber: 1, accountId: totalGainLoss > 0 ? arAccount.id : fxAccount.id, description: 'FX revaluation adjustment', debit: totalGainLoss > 0 ? totalGainLoss : 0, credit: 0 },
            { journalId: (await db.journal.findFirst({ where: { journalNumber }, orderBy: { createdAt: 'desc' } }))!.id, lineNumber: 2, accountId: totalGainLoss > 0 ? fxAccount.id : arAccount.id, description: 'FX revaluation adjustment', debit: 0, credit: totalGainLoss > 0 ? 0 : Math.abs(totalGainLoss) },
          ],
        })
        journalCreated = true
      }
    }

    await logAudit({
      action: 'FX_REVALUATION',
      entityType: 'Journal',
      description: `FX revaluation run for ${revDate.toISOString().slice(0, 10)} — ${results.length} items, total gain/loss: ${totalGainLoss} cents, journal created: ${journalCreated}`,
    })

    return ok({
      revaluationDate: revDate.toISOString(),
      baseCurrency,
      itemsProcessed: results.length,
      totalGainLoss,
      journalCreated,
      details: results,
    })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'FX revaluation failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
