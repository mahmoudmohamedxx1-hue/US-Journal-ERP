import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { executeRecurringJournal, executeDueRecurringJournals } from '@/lib/recurring'

// POST /api/recurring-journals/execute — execute a single recurring journal
// Body: { recurringJournalId: string }
// If no ID provided, executes ALL due recurring journals (cron mode)
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))

    if (body.recurringJournalId) {
      // Execute single recurring journal
      const result = await executeRecurringJournal(body.recurringJournalId, ctx.organizationId, ctx.userId)
      return ok({ result })
    } else {
      // Execute ALL due recurring journals (cron mode)
      const results = await executeDueRecurringJournals(ctx.organizationId, ctx.userId)
      return ok({ results, message: `Executed ${results.executed} recurring journals, ${results.failed} failed` })
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
