import { NextRequest } from 'next/server'
import { loginWithCredentials, setSessionCookie } from '@/lib/auth'
import { ok, err, logAudit } from '@/lib/api'

// POST /api/auth/login
// Body: { email, password }
// Sets an HTTP-only session cookie on success.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { email, password } = body

    if (!email || !password) {
      return err('Email and password are required', 422, undefined, 'VALIDATION_ERROR')
    }

    const result = await loginWithCredentials(String(email), String(password))
    if (!result.success || !result.token || !result.user) {
      return err(result.error || 'Login failed', 401, undefined, 'AUTH_FAILED')
    }

    await setSessionCookie(result.token)
    await logAudit({
      action: 'LOGIN',
      entityType: 'User',
      entityId: result.user.id,
      description: `${result.user.email} logged in`,
      userId: result.user.id,
    })

    return ok({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
    })
  } catch (e) {
    return err(
      e instanceof Error ? e.message : 'Login failed',
      500,
      undefined,
      'INTERNAL_ERROR',
    )
  }
}
