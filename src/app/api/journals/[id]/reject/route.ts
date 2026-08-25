import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, logAudit, getSystemContext } from "@/lib/api"

// POST /api/journals/[id]/reject — reject a Submitted journal, returns to Draft
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSystemContext()
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const reason = body.reason || 'No reason provided'

  const journal = await db.journal.findFirst({
    where: { id, organizationId: ctx.organizationId },
  })
  if (!journal) return err('Journal not found', 404)
  if (!['Submitted', 'Under Review', 'Approved'].includes(journal.status)) {
    return err(`Cannot reject — current status: ${journal.status}`, 422)
  }

  await db.journal.update({
    where: { id },
    data: { status: 'Rejected', rejectionReason: reason },
  })
  await db.journalApproval.create({
    data: {
      journalId: id,
      action: 'Rejected',
      byUserId: ctx.userId,
      comment: reason,
    },
  })
  await logAudit({
    action: 'REJECT_JOURNAL',
    entityType: 'Journal',
    entityId: id,
    description: `Rejected journal ${journal.journalNumber} — ${reason}`,
  })
  return ok({ success: true })
}
