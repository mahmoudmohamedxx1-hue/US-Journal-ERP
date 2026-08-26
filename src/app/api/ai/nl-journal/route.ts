import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { parseJournalCommand } from '@/lib/ai/glm'
import { db } from '@/lib/db'

// POST /api/ai/nl-journal
// Body: { instruction: string }
// Returns: ParsedJournal with debit/credit accounts + amount
export async function POST(req: NextRequest) {
  try {
    await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const instruction = String(body.instruction || '').trim()
    if (!instruction) return err('instruction is required', 422)
    if (instruction.length > 1000) return err('instruction too long (max 1000 chars)', 422)

    // Pass available accounts to AI so it can match codes
    const accounts = await db.account.findMany({
      select: { code: true, name: true },
      take: 200,
      orderBy: { code: 'asc' },
    })

    const result = await parseJournalCommand(instruction, { availableAccounts: accounts })
    if (!result.ok) {
      return ok({ ai: result, parsed: null }, 200) // return 200 with error info — UI shows friendly message
    }
    return ok({ ai: result, parsed: result.data }, 200)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500)
  }
}
