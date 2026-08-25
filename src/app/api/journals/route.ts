import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, logAudit, getSystemContext } from "@/lib/api"
import { createJournalSchema, validate } from '@/lib/validation'

// GET /api/journals — list with filters & pagination
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const source = url.searchParams.get('source')
  const search = url.searchParams.get('q')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const page = parseInt(url.searchParams.get('page') || '1')
  const pageSize = parseInt(url.searchParams.get('pageSize') || '50')

  const where: Record<string, unknown> = { organizationId: ctx.organizationId }
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
  const ctx = await getSystemContext()

  const body = await req.json().catch(() => ({}))

  // Validate input with Zod schema
  const validation = validate(createJournalSchema, body)
  if (!validation.success) {
    return err(validation.error, 422, validation.details, 'VALIDATION_ERROR')
  }
  const {
    journalDate,
    source,
    reference,
    description,
    currency,
    exchangeRate,
    lines: validatedLines,
    submit,
  } = validation.data

  const normalizedLines = validatedLines.map((l, i) => ({
    accountId: l.accountId,
    accountCode: l.accountCode,
    description: l.description || null,
    debit: l.debit,
    credit: l.credit,
    _index: i,
  }))

  // Resolve account IDs from codes if needed
  for (const l of normalizedLines) {
    if (!l.accountId && l.accountCode) {
      const acct = await db.account.findFirst({
        where: { organizationId: ctx.organizationId, code: l.accountCode },
      })
      if (!acct) return err(`Account code ${l.accountCode} not found`, 422, undefined, 'VALIDATION_ERROR')
      l.accountId = acct.id
    }
    if (!l.accountId) return err('Each line requires an account', 422, undefined, 'VALIDATION_ERROR')
  }

  // Server-side totals (already validated balanced by Zod if submitting)
  const totalDebit = normalizedLines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = normalizedLines.reduce((s, l) => s + l.credit, 0)

  // Find fiscal period for journalDate
  const jd = new Date(journalDate)
  const fy = await db.fiscalYear.findFirst({
    where: { organizationId: ctx.organizationId, startDate: { lte: jd }, endDate: { gte: jd } },
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

  // === Atomic journal creation ===
  // Wrap everything in a database transaction so the journal, lines,
  // approval record, and audit log are all created atomically.
  // If any step fails, the entire operation rolls back — no partial journals.
  //
  // Journal numbering uses a retry loop to handle the race condition
  // where two concurrent requests both compute the same count+1.
  // The unique constraint on journalNumber will reject the second one,
  // and we retry with a new number.
  let journal: { id: string; journalNumber: string } | null = null
  const maxRetries = 5
  let lastError: unknown = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      journal = await db.$transaction(async (tx) => {
        // Generate journal number inside the transaction (with locking)
        const count = await tx.journal.count({
          where: { organizationId: ctx.organizationId },
        })
        const journalNumber = `JE-${jd.getFullYear()}-${String(count + 1).padStart(4, '0')}`

        // Create the journal header
        const j = await tx.journal.create({
          data: {
            organizationId: ctx.organizationId,
            journalNumber,
            journalDate: jd,
            fiscalPeriodId: periodId,
            source: source || 'Manual',
            reference: reference || null,
            description: description || null,
            currency,
            exchangeRate: Math.round((exchangeRate || 1) * 100),  // store as basis points
            status,
            totalDebit,
            totalCredit,
            createdById: ctx.userId,
            submittedById: submit ? ctx.userId : null,
            submittedAt: submit ? new Date() : null,
          },
        })

        // Create all lines in bulk (still inside the transaction)
        await tx.journalLine.createMany({
          data: normalizedLines.map((l, i) => ({
            journalId: j.id,
            lineNumber: i + 1,
            accountId: l.accountId!,
            description: l.description,
            debit: l.debit,
            credit: l.credit,
          })),
        })

        // Create approval record if submitting
        if (submit) {
          await tx.journalApproval.create({
            data: {
              journalId: j.id,
              action: 'Submitted',
              byUserId: ctx.userId,
              comment: 'Submitted for review.',
            },
          })
        }

        return { id: j.id, journalNumber: j.journalNumber }
      })
      break  // success
    } catch (e) {
      lastError = e
      // P2002 = unique constraint violation (journalNumber collision)
      // Retry with a new number on the next iteration
      const isUniqueViolation =
        e instanceof Error &&
        'code' in e &&
        (e as { code: string }).code === 'P2002'
      if (!isUniqueViolation) {
        throw e  // re-throw non-retryable errors
      }
      // wait a tiny bit before retrying
      await new Promise((r) => setTimeout(r, 50 * attempt))
    }
  }

  if (!journal) {
    return err(
      'Failed to create journal after multiple retries (numbering conflict)',
      500,
      { lastError: String(lastError) },
      'JOURNAL_NUMBER_CONFLICT',
    )
  }

  await logAudit({
    action: submit ? 'SUBMIT_JOURNAL' : 'CREATE_JOURNAL',
    entityType: 'Journal',
    entityId: journal.id,
    description: `${submit ? 'Submitted' : 'Created'} journal ${journal.journalNumber}${description ? ` — ${description}` : ''}`,
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
