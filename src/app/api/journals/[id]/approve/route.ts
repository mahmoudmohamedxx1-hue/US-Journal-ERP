import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, logAudit, getSystemContext } from "@/lib/api"

// POST /api/journals/[id]/approve — approve a Submitted journal
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSystemContext()
  const { id } = await params
  const journal = await db.journal.findFirst({
    where: { id, organizationId: ctx.organizationId },
  })
  if (!journal) return err('Journal not found', 404)
  if (!['Submitted', 'Under Review'].includes(journal.status)) {
    return err(`Cannot approve — current status: ${journal.status}`, 422)
  }

  await db.journal.update({
    where: { id },
    data: {
      status: 'Approved',
      approvedById: ctx.userId,
      approvedAt: new Date(),
    },
  })
  await db.journalApproval.create({
    data: { journalId: id, action: 'Approved', byUserId: ctx.userId },
  })
  await logAudit({
    action: 'APPROVE_JOURNAL',
    entityType: 'Journal',
    entityId: id,
    description: `Approved journal ${journal.journalNumber}`,
  })
  return ok({ success: true })
}
