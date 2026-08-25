import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/health
// Returns database connectivity, environment, and basic system info.
// Used by the desktop app to detect first-run / database issues.
export async function GET() {
  const checks: Record<string, { status: 'ok' | 'fail'; detail?: string }> = {}

  // 1. Environment
  checks.environment = {
    status: process.env.DATABASE_URL ? 'ok' : 'fail',
    detail: process.env.DATABASE_URL
      ? undefined
      : 'DATABASE_URL env var not set',
  }

  // 2. Database connection (count a known table)
  try {
    await db.organization.count()
    checks.database = { status: 'ok' }
  } catch (e) {
    checks.database = {
      status: 'fail',
      detail: e instanceof Error ? e.message : String(e),
    }
  }

  // 3. Seed verification — is there at least 1 user?
  try {
    const userCount = await db.user.count()
    checks.seeded = {
      status: userCount > 0 ? 'ok' : 'fail',
      detail: userCount > 0 ? `${userCount} users` : 'No users — run `bun run seed`',
    }
  } catch (e) {
    checks.seeded = {
      status: 'fail',
      detail: e instanceof Error ? e.message : String(e),
    }
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok')
  return ok(
    {
      status: allOk ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    },
    allOk ? 200 : 503,
  )
}
