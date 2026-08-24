import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, logAudit } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/journals/[id] — fetch full journal detail with lines, approvals, audit history
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const { id } = await params
  const journal = await db.journal.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      lines: {
        include: { account: true },
        orderBy: { lineNumber: 'asc' },
      },
      approvals: { include: { byUser: true }, orderBy: { at: 'asc' } },
      attachments: true,
      fiscalPeriod: true,
      createdBy: true,
      submittedBy: true,
      approvedBy: true,
      postedBy: true,
      reversalOf: true,
    },
  })

  if (!journal) return err('Journal not found', 404)
  return ok({ journal })
}

// PATCH /api/journals/[id] — update a Draft journal
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const existing = await db.journal.findFirst({
    where: { id, organizationId: user.organizationId },
  })
  if (!existing) return err('Journal not found', 404)
  if (existing.status !== 'Draft') {
    return err(`Only Draft journals can be edited (current status: ${existing.status})`, 422)
  }

  const { journalDate, source, reference, description, lines = [] } = body

  if (!Array.isArray(lines) || lines.length < 2) {
    return err('A journal must contain at least two lines', 422)
  }

  // Normalize lines
  const normalizedLines = lines.map((l: {
    accountId?: string
    accountCode?: string
    description?: string
    debit?: number
    credit?: number
  }, i: number) => {
    const debit = Number(l.debit ?? 0)
    const credit = Number(l.credit ?? 0)
    if (debit < 0 || credit < 0) throw new Error(`Line ${i + 1}: amounts must be positive`)
    if (debit > 0 && credit > 0) {
      throw new Error(`Line ${i + 1}: debit and credit cannot both be entered`)
    }
    return {
      accountId: l.accountId,
      accountCode: l.accountCode,
      description: l.description || null,
      debit,
      credit,
    }
  })

  for (const l of normalizedLines) {
    if (!l.accountId && l.accountCode) {
      const acct = await db.account.findFirst({
        where: { organizationId: user.organizationId, code: l.accountCode },
      })
      if (!acct) return err(`Account code ${l.accountCode} not found`, 422)
      l.accountId = acct.id
    }
    if (!l.accountId) return err('Each line requires an account', 422)
  }

  // Server-side total recalculation
  const totalDebit = normalizedLines.reduce(
    (s: number, l: { debit: number }) => s + (l.debit || 0),
    0,
  )
  const totalCredit = normalizedLines.reduce(
    (s: number, l: { credit: number }) => s + (l.credit || 0),
    0,
  )

  // Update header
  const jd = journalDate ? new Date(journalDate) : existing.journalDate
  await db.journal.update({
    where: { id },
    data: {
      journalDate: jd,
      source: source ?? existing.source,
      reference: reference ?? existing.reference,
      description: description ?? existing.description,
      totalDebit,
      totalCredit,
    },
  })

  // Replace lines
  await db.journalLine.deleteMany({ where: { journalId: id } })
  for (let i = 0; i < normalizedLines.length; i++) {
    const l = normalizedLines[i]
    await db.journalLine.create({
      data: {
        journalId: id,
        lineNumber: i + 1,
        accountId: l.accountId,
        description: l.description,
        debit: l.debit,
        credit: l.credit,
      },
    })
  }

  await logAudit({
    action: 'UPDATE_JOURNAL',
    entityType: 'Journal',
    entityId: id,
    description: `Updated journal ${existing.journalNumber}`,
  })

  const updated = await db.journal.findUniqueOrThrow({
    where: { id },
    include: {
      lines: { include: { account: true }, orderBy: { lineNumber: 'asc' } },
      approvals: { include: { byUser: true }, orderBy: { at: 'asc' } },
    },
  })
  return ok({ journal: updated })
}

// DELETE /api/journals/[id] — only Draft can be deleted
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const { id } = await params
  const journal = await db.journal.findFirst({
    where: { id, organizationId: user.organizationId },
  })
  if (!journal) return err('Journal not found', 404)
  if (journal.status !== 'Draft') {
    return err('Only Draft journals can be deleted', 422)
  }

  await db.journalLine.deleteMany({ where: { journalId: id } })
  await db.journalApproval.deleteMany({ where: { journalId: id } })
  await db.journal.delete({ where: { id } })

  await logAudit({
    action: 'DELETE_JOURNAL',
    entityType: 'Journal',
    description: `Deleted journal ${journal.journalNumber}`,
  })
  return ok({ success: true })
}
