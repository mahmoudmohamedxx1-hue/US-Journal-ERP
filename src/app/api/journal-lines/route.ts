import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/journal-lines — drill-down: get journal lines for a specific account
// Query params: accountId, from, to
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const accountId = url.searchParams.get('accountId')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const page = parseInt(url.searchParams.get('page') || '1')
  const pageSize = parseInt(url.searchParams.get('pageSize') || '50')

  if (!accountId) return err('accountId is required', 422, undefined, 'VALIDATION_ERROR')

  // Build the where clause for journal lines
  const whereJournal: Record<string, unknown> = {
    organizationId: ctx.organizationId,
    status: 'Posted',
  }
  if (from || to) {
    whereJournal.journalDate = {}
    if (from) (whereJournal.journalDate as { gte?: Date }).gte = new Date(from)
    if (to) (whereJournal.journalDate as { lte?: Date }).lte = new Date(to)
  }

  const [total, lines] = await Promise.all([
    db.journalLine.count({
      where: {
        accountId,
        journal: { ...whereJournal },
      },
    }),
    db.journalLine.findMany({
      where: {
        accountId,
        journal: whereJournal as Record<string, unknown>,
      },
      include: {
        journal: { select: { journalNumber: true, journalDate: true, description: true, status: true } },
        account: { select: { code: true, name: true } },
      },
      orderBy: { journal: { journalDate: 'desc' } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  // Calculate running balance
  let runningBalance = 0
  const linesWithBalance = lines.reverse().map((l) => {
    runningBalance += l.debit - l.credit
    return {
      ...l,
      runningBalance,
    }
  }).reverse()

  return ok({
    lines: linesWithBalance,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}
