import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { DEMO_ORG_ID, DEMO_USER_ID, ok, err, logAudit } from '@/lib/api'

// POST /api/journals/[id]/submit — submit a Draft journal for approval
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const journal = await db.journal.findFirst({
    where: { id, organizationId: DEMO_ORG_ID },
    include: { lines: true, fiscalPeriod: true },
  })
  if (!journal) return err('Journal not found', 404)
  if (journal.status !== 'Draft') {
    return err(`Cannot submit — current status: ${journal.status}`, 422)
  }
  if (journal.lines.length < 2) {
    return err('A journal must have at least two lines', 422)
  }
  const totalDebit = journal.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = journal.lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    return err(
      `Journal is not balanced — debits ${totalDebit.toFixed(2)} vs credits ${totalCredit.toFixed(2)}`,
      422,
    )
  }
  if (journal.fiscalPeriod && journal.fiscalPeriod.status === 'Closed') {
    return err(
      `Cannot submit into closed fiscal period: ${journal.fiscalPeriod.name}`,
      422,
    )
  }

  await db.journal.update({
    where: { id },
    data: {
      status: 'Submitted',
      submittedById: DEMO_USER_ID,
      submittedAt: new Date(),
    },
  })
  await db.journalApproval.create({
    data: { journalId: id, action: 'Submitted', byUserId: DEMO_USER_ID },
  })
  await logAudit({
    action: 'SUBMIT_JOURNAL',
    entityType: 'Journal',
    entityId: id,
    description: `Submitted journal ${journal.journalNumber} for approval`,
  })
  return ok({ success: true })
}
