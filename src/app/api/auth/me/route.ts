import { getCurrentUser } from '@/lib/auth'
import { ok, err } from '@/lib/api'

// GET /api/auth/me
// Returns the currently-authenticated user, or 401.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return err('Unauthorized', 401, undefined, 'UNAUTHORIZED')
    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
    })
  } catch (e) {
    return err(
      e instanceof Error ? e.message : 'Failed to fetch user',
      500,
      undefined,
      'INTERNAL_ERROR',
    )
  }
}
