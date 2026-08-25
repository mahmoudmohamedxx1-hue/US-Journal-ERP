import { NextRequest } from 'next/server'
import { clearSession, getCurrentUser } from '@/lib/auth'
import { ok, logAudit } from '@/lib/api'

// POST /api/auth/logout
// Clears the session cookie and deletes the session from the DB.
export async function POST(_req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (user) {
      await logAudit({
        action: 'LOGOUT',
        entityType: 'User',
        entityId: user.id,
        description: `${user.email} logged out`,
        userId: user.id,
      })
    }
    await clearSession()
    return ok({ success: true })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Logout failed', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
