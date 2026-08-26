import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { suggestAccount } from '@/lib/ai/glm'
import { db } from '@/lib/db'

// POST /api/ai/suggest-account
// Body: { description: string }
// Returns: { account: string, confidence, reason }
export async function POST(req: NextRequest) {
  try {
    await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const description = String(body.description || '').trim()
    if (!description) return err('description is required', 422)

    const accounts = await db.account.findMany({
      select: { code: true, name: true, accountType: true },
      take: 300,
      orderBy: { code: 'asc' },
    })

    const result = await suggestAccount(description, accounts.map(a => ({ code: a.code, name: a.name, type: a.accountType })))
    return ok({ ai: result, suggestion: result.data || null }, 200)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500)
  }
}
