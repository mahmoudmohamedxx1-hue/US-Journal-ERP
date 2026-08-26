import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { voiceToJournal } from '@/lib/ai/glm'
import { db } from '@/lib/db'

// POST /api/ai/voice-journal
// Body: { audio: base64, mimeType?: string }
// Returns: { transcript: string, parsed?: ParsedJournal }
export async function POST(req: NextRequest) {
  try {
    await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const audio = String(body.audio || '')
    if (!audio) return err('audio (base64) is required', 422)

    const accounts = await db.account.findMany({
      select: { code: true, name: true },
      take: 200,
      orderBy: { code: 'asc' },
    })

    const result = await voiceToJournal(audio, body.mimeType || 'audio/wav', { availableAccounts: accounts })
    return ok({ ai: result, transcript: result.data?.transcript || null, parsed: result.data?.parsed || null }, 200)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500)
  }
}
