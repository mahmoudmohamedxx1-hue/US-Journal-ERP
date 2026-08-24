import { db } from '@/lib/db'
import { ok } from '@/lib/api'

/**
 * GET /api/setup/status
 *
 * Returns whether the database needs first-run initialization.
 * The frontend uses this to decide whether to show the Setup Wizard
 * or the Login screen.
 *
 * Response:
 *   {
 *     needsSetup: boolean,    // true if no users exist in DB
 *     userCount: number,      // total users
 *     orgCount: number,       // total organizations
 *     dbReady: boolean,       // false if Prisma can't connect
 *   }
 */
export async function GET() {
  try {
    const [userCount, orgCount] = await Promise.all([
      db.user.count(),
      db.organization.count(),
    ])

    return ok({
      needsSetup: userCount === 0,
      userCount,
      orgCount,
      dbReady: true,
    })
  } catch (e) {
    return ok({
      needsSetup: true,
      userCount: 0,
      orgCount: 0,
      dbReady: false,
      error: e instanceof Error ? e.message : 'Database not accessible',
    })
  }
}
