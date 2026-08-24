import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok, err, logAudit } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// POST /api/journals/[id]/approve — approve a Submitted journal
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const { id } = await params
  const journal = await db.journal.findFirst({
    where: { id, organizationId: DEMO_ORG_ID },
  })
  if (!journal) return err('Journal not found', 404)
  if (!['Submitted', 'Under Review'].includes(journal.status)) {
    return err(`Cannot approve — current status: ${journal.status}`, 422)
  }

  await db.journal.update({
    where: { id },
    data: {
      status: 'Approved',
      approvedById: user.id,
      approvedAt: new Date(),
    },
  })
  await db.journalApproval.create({
    data: { journalId: id, action: 'Approved', byUserId: user.id },
  })
  await logAudit({
    action: 'APPROVE_JOURNAL',
    entityType: 'Journal',
    entityId: id,
    description: `Approved journal ${journal.journalNumber}`,
  })
  return ok({ success: true })
}
