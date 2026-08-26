import { ok, err, getSystemContext, logAudit } from '@/lib/api'
import { db } from '@/lib/db'

// POST /api/journals/repair-hashes — recompute ALL posted journal hashes in order
// This fixes the entire hash chain by recomputing every entry sequentially
export async function POST() {
  try {
    const ctx = await getSystemContext()

    // Get ALL posted journals ordered by posting date
    const postedJournals = await db.journal.findMany({
      where: { organizationId: ctx.organizationId, status: 'Posted' },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
      orderBy: { postedAt: 'asc' },
    })

    let repaired = 0
    let failed = 0
    let prevHash = ''

    for (const journal of postedJournals) {
      try {
        // Build hash content
        const hashFields = {
          id: journal.id,
          journalNumber: journal.journalNumber,
          journalDate: journal.journalDate.toISOString(),
          source: journal.source || '',
          reference: journal.reference || '',
          description: journal.description || '',
          totalDebit: journal.totalDebit,
          totalCredit: journal.totalCredit,
          currency: journal.currency,
          prevHash,
          lines: journal.lines.map(l => ({
            lineNumber: l.lineNumber,
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description || '',
          })),
        }

        const crypto = await import('crypto')
        const content = JSON.stringify(hashFields, Object.keys(hashFields).sort())
        const hash = crypto.createHash('sha256').update(content).digest('hex')

        await db.journal.update({
          where: { id: journal.id },
          data: { inalterableHash: hash },
        })

        prevHash = hash
        repaired++
      } catch (e) {
        failed++
        console.error(`[repair] Failed for ${journal.journalNumber}:`, e)
      }
    }

    await logAudit({
      action: 'REPAIR_HASH_CHAIN',
      entityType: 'Journal',
      description: `Repaired hash chain: ${repaired} entries recomputed, ${failed} failed`,
      organizationId: ctx.organizationId,
    })

    return ok({
      repaired,
      failed,
      totalProcessed: postedJournals.length,
      message: `Repaired ${repaired} journal hashes (full chain recomputation), ${failed} failed`,
    })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
