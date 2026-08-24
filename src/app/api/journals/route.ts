import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok, err, logAudit } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/journals — list with filters & pagination
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const source = url.searchParams.get('source')
  const search = url.searchParams.get('q')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const page = parseInt(url.searchParams.get('page') || '1')
  const pageSize = parseInt(url.searchParams.get('pageSize') || '50')

  const where: Record<string, unknown> = { organizationId: DEMO_ORG_ID }
  if (status) where.status = status
  if (source) where.source = source
  if (search) {
    where.OR = [
      { journalNumber: { contains: search } },
      { description: { contains: search } },
      { reference: { contains: search } },
    ]
  }
  if (from || to) {
    where.journalDate = {}
    if (from) (where.journalDate as { gte?: Date }).gte = new Date(from)
    if (to) (where.journalDate as { lte?: Date }).lte = new Date(to)
  }

  const [total, journals] = await Promise.all([
    db.journal.count({ where }),
    db.journal.findMany({
      where,
      include: {
        lines: { include: { account: true } },
        createdBy: true,
        approvedBy: true,
        postedBy: true,
        fiscalPeriod: true,
      },
      orderBy: [{ journalDate: 'desc' }, { journalNumber: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return ok({
    journals,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}

// POST /api/journals — create new journal entry
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const body = await req.json().catch(() => ({}))
  const {
    journalDate,
    source,
    reference,
    description,
    currency = 'USD',
    exchangeRate = 1.0,
    lines = [],
    submit = false,
  } = body

  // Validate input
  if (!journalDate) return err('journalDate is required', 422)
  if (!Array.isArray(lines) || lines.length < 2) {
    return err('A journal must contain at least two lines', 422)
  }

  // Normalize lines: ensure exactly one of debit/credit per line
  const normalizedLines = lines.map((l: {
    accountId?: string
    accountCode?: string
    description?: string
    debit?: number
    credit?: number
  }, i: number) => {
    const debit = Number(l.debit ?? 0)
    const credit = Number(l.credit ?? 0)
    if (debit < 0 || credit < 0) {
      throw new Error(`Line ${i + 1}: amounts must be positive`)
    }
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

  // Resolve account IDs from codes if needed
  for (const l of normalizedLines) {
    if (!l.accountId && l.accountCode) {
      const acct = await db.account.findFirst({
        where: { organizationId: DEMO_ORG_ID, code: l.accountCode },
      })
      if (!acct) return err(`Account code ${l.accountCode} not found`, 422)
      l.accountId = acct.id
    }
    if (!l.accountId) return err('Each line requires an account', 422)
  }

  // Server-side balance check — never trust client totals
  const totalDebit = normalizedLines.reduce(
    (s: number, l: { debit: number }) => s + (l.debit || 0),
    0,
  )
  const totalCredit = normalizedLines.reduce(
    (s: number, l: { credit: number }) => s + (l.credit || 0),
    0,
  )

  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005
  if (submit && !isBalanced) {
    return err(
      `Journal is not balanced — debits (${totalDebit.toFixed(2)}) ≠ credits (${totalCredit.toFixed(2)})`,
      422,
    )
  }

  // Generate next journal number
  const count = await db.journal.count({ where: { organizationId: DEMO_ORG_ID } })
  const journalNumber = `JE-2026-${String(count + 1).padStart(4, '0')}`

  // Find fiscal period for journalDate
  const jd = new Date(journalDate)
  const fy = await db.fiscalYear.findFirst({
    where: { organizationId: DEMO_ORG_ID, startDate: { lte: jd }, endDate: { gte: jd } },
  })
  let periodId: string | null = null
  if (fy) {
    const period = await db.fiscalPeriod.findFirst({
      where: { fiscalYearId: fy.id, startDate: { lte: jd }, endDate: { gte: jd } },
    })
    if (period) {
      if (period.status === 'Closed') {
        return err(`Cannot post into closed fiscal period: ${period.name}`, 422)
      }
      periodId = period.id
    }
  }

  const status = submit ? 'Submitted' : 'Draft'

  const journal = await db.journal.create({
    data: {
      organizationId: DEMO_ORG_ID,
      journalNumber,
      journalDate: jd,
      fiscalPeriodId: periodId,
      source: source || 'Manual',
      reference: reference || null,
      description: description || null,
      currency,
      exchangeRate,
      status,
      totalDebit,
      totalCredit,
      createdById: user.id,
      submittedById: submit ? user.id : null,
      submittedAt: submit ? new Date() : null,
    },
  })

  // Create lines
  for (let i = 0; i < normalizedLines.length; i++) {
    const l = normalizedLines[i]
    await db.journalLine.create({
      data: {
        journalId: journal.id,
        lineNumber: i + 1,
        accountId: l.accountId,
        description: l.description,
        debit: l.debit,
        credit: l.credit,
      },
    })
  }

  if (submit) {
    await db.journalApproval.create({
      data: {
        journalId: journal.id,
        action: 'Submitted',
        byUserId: user.id,
        comment: 'Submitted for review.',
      },
    })
  }

  await logAudit({
    action: submit ? 'SUBMIT_JOURNAL' : 'CREATE_JOURNAL',
    entityType: 'Journal',
    entityId: journal.id,
    description: `${submit ? 'Submitted' : 'Created'} journal ${journalNumber}${description ? ` — ${description}` : ''}`,
  })

  const fullJournal = await db.journal.findUniqueOrThrow({
    where: { id: journal.id },
    include: {
      lines: { include: { account: true }, orderBy: { lineNumber: 'asc' } },
      createdBy: true,
    },
  })

  return ok({ journal: fullJournal }, 201)
}
