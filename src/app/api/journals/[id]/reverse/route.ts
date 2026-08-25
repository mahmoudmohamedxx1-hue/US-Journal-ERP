import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, logAudit, getSystemContext } from "@/lib/api"

// POST /api/journals/[id]/reverse — create a reversal of a Posted journal
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSystemContext()
  const { id } = await params

  const original = await db.journal.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: { lines: { include: { account: true } } },
  })
  if (!original) return err('Journal not found', 404)
  if (original.status !== 'Posted') {
    return err(`Only Posted journals can be reversed (current: ${original.status})`, 422)
  }
  if (original.reversalOfId) {
    return err('Reversal journals cannot themselves be reversed', 422)
  }

  // Generate reversal number
  const count = await db.journal.count({ where: { organizationId: ctx.organizationId } })
  const reversalNumber = `JE-2026-${String(count + 1).padStart(4, '0')}`

  // Reverse debit/credit on every line
  const reversedLines = original.lines.map((l) => ({
    accountId: l.accountId,
    description: `REVERSAL: ${l.description ?? ''}`.trim(),
    debit: l.credit, // swap
    credit: l.debit,
  }))

  const totalDebit = reversedLines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = reversedLines.reduce((s, l) => s + l.credit, 0)

  // Transaction — atomic reversal
  const reversal = await db.$transaction(async (tx) => {
    const rev = await tx.journal.create({
      data: {
        organizationId: ctx.organizationId,
        journalNumber: reversalNumber,
        journalDate: new Date(),
        fiscalPeriodId: original.fiscalPeriodId,
        source: 'Reversal',
        reference: `Reversal of ${original.journalNumber}`,
        description: `Reversal of ${original.journalNumber} — ${original.description ?? ''}`,
        currency: original.currency,
        exchangeRate: original.exchangeRate,
        status: 'Posted', // posted immediately
        totalDebit,
        totalCredit,
        createdById: ctx.userId,
        postedById: ctx.userId,
        postedAt: new Date(),
        reversalOfId: original.id,
      },
    })

    for (let i = 0; i < reversedLines.length; i++) {
      const l = reversedLines[i]
      await tx.journalLine.create({
        data: {
          journalId: rev.id,
          lineNumber: i + 1,
          accountId: l.accountId,
          description: l.description,
          debit: l.debit,
          credit: l.credit,
        },
      })
    }

    // Mark original as Reversed
    await tx.journal.update({
      where: { id: original.id },
      data: { status: 'Reversed' },
    })

    await tx.journalApproval.create({
      data: { journalId: rev.id, action: 'Posted', byUserId: ctx.userId },
    })

    return rev
  })

  await logAudit({
    action: 'REVERSE_JOURNAL',
    entityType: 'Journal',
    entityId: reversal.id,
    description: `Reversed journal ${original.journalNumber} with reversal ${reversalNumber}`,
  })

  return ok({ success: true, reversalId: reversal.id, reversalNumber })
}
