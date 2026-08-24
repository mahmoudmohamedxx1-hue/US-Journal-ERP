import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok, err, logAudit } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// POST /api/journals/[id]/post — post an Approved journal to the GL
// Uses a database transaction for atomicity
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const { id } = await params

  const journal = await db.journal.findFirst({
    where: { id, organizationId: DEMO_ORG_ID },
    include: { lines: true, fiscalPeriod: true },
  })
  if (!journal) return err('Journal not found', 404)
  if (journal.status !== 'Approved') {
    return err(`Cannot post — current status: ${journal.status}`, 422)
  }

  // Server-side recompute totals (defense in depth)
  const totalDebit = journal.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = journal.lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    return err(
      `Cannot post — journal not balanced (debits ${totalDebit.toFixed(2)} vs credits ${totalCredit.toFixed(2)})`,
      422,
    )
  }

  // Block posting into closed period
  if (journal.fiscalPeriod && journal.fiscalPeriod.status === 'Closed') {
    return err(
      `Cannot post into closed fiscal period: ${journal.fiscalPeriod.name}`,
      422,
    )
  }

  // Atomic post — transaction ensures GL state stays consistent
  await db.$transaction(async (tx) => {
    await tx.journal.update({
      where: { id },
      data: {
        status: 'Posted',
        postedById: user.id,
        postedAt: new Date(),
        postingDate: new Date(),
        totalDebit,
        totalCredit,
      },
    })
    await tx.journalApproval.create({
      data: { journalId: id, action: 'Posted', byUserId: user.id },
    })
  })

  await logAudit({
    action: 'POST_JOURNAL',
    entityType: 'Journal',
    entityId: id,
    description: `Posted journal ${journal.journalNumber} (${journal.description}) to the general ledger`,
  })

  return ok({ success: true, posted: true })
}
