import { ok, err, getSystemContext } from '@/lib/api'
import { verifyDataIntegrity, checkDatabaseHealth, verifyDatabaseConstraints, getRecentWriteIntents } from '@/lib/db-reliability'
import { verifyJournalHashChain } from '@/lib/invoice-autopost'

// GET /api/integrity-check — comprehensive data integrity check
export async function GET() {
  try {
    const ctx = await getSystemContext()

    // Run all checks in parallel
    const [dataIntegrity, hashChain, dbHealth, constraints, writeIntents] = await Promise.all([
      verifyDataIntegrity(ctx.organizationId),
      verifyJournalHashChain(ctx.organizationId),
      checkDatabaseHealth(),
      verifyDatabaseConstraints(),
      Promise.resolve(getRecentWriteIntents(10)),
    ])

    const allIssues = [
      ...dataIntegrity.issues,
      ...hashChain.broken.map(b => ({ type: 'HASH_BROKEN', description: b.reason, severity: 'error' as const })),
    ]

    return ok({
      overall: allIssues.filter(i => i.severity === 'error').length === 0 ? 'healthy' : 'issues_found',
      dataIntegrity,
      hashChain: {
        total: hashChain.total,
        hashed: hashChain.hashed,
        broken: hashChain.broken.length,
        message: hashChain.message,
      },
      database: {
        healthy: dbHealth.healthy,
        latencyMs: dbHealth.latencyMs,
        error: dbHealth.error,
        constraintsValid: constraints.valid,
        missingConstraints: constraints.missing,
      },
      recentWriteIntents: writeIntents,
      summary: {
        totalIssues: allIssues.length,
        errors: allIssues.filter(i => i.severity === 'error').length,
        warnings: allIssues.filter(i => i.severity === 'warning').length,
        journalsChecked: dataIntegrity.balanced ? hashChain.total : 0,
      },
    })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
