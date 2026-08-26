import { ok, err, getSystemContext } from '@/lib/api'
import { verifyJournalHashChain } from '@/lib/invoice-autopost'

// GET /api/journals/hash-verify — verify the hash chain integrity of all posted journals
export async function GET() {
  const ctx = await getSystemContext()
  const result = await verifyJournalHashChain(ctx.organizationId)
  return ok({ ...result, message: result.broken.length === 0 ? 'All journal entries are intact — hash chain verified' : `${result.broken.length} entries have broken hashes` })
}
