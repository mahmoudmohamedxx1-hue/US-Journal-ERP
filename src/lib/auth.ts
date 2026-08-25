/**
 * Authentication & authorization — session-based auth using HTTP-only cookies.
 *
 * Sessions are stored in the Session table (revocable, expirable).
 * Cookies carry an opaque session token; the user is resolved by lookup.
 *
 * Roles enforced:
 *   Viewer        — read-only access to dashboards & reports
 *   Accountant    — create/edit draft journals, view everything
 *   Approver      — approve or reject submitted journals
 *   Controller    — post approved journals, reverse, close periods
 *   Administrator — manage users, organization, fiscal periods
 *   Auditor       — read-only access to everything including audit log
 */
import { db } from './db'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

export const SESSION_COOKIE = 'usj_session'
const SESSION_TTL_DAYS = 7

export type Role =
  | 'Viewer'
  | 'Accountant'
  | 'Approver'
  | 'Controller'
  | 'Administrator'
  | 'Auditor'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
  organizationId: string
}

/**
 * Resolve the current user from the session cookie.
 * Returns null if not authenticated, session expired, or user inactive.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return null

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    })
    if (!session) return null
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {})
      return null
    }
    if (!session.user.active) return null

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as Role,
      organizationId: session.user.organizationId,
    }
  } catch {
    return null
  }
}

/**
 * Resolve the current user or return a 401 Response.
 * Use in API routes that require authentication.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return user
}

/**
 * Require the current user to have one of the allowed roles.
 * Returns the user if allowed, otherwise throws a 403 Response.
 */
export async function requireRole(...allowedRoles: Role[]): Promise<AuthUser> {
  const user = await requireUser()
  if (!allowedRoles.includes(user.role)) {
    throw new Response(
      JSON.stringify({
        error: `Forbidden — requires role: ${allowedRoles.join(' or ')}`,
        code: 'FORBIDDEN',
        userRole: user.role,
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
  return user
}

/**
 * Verify email + password and create a new session.
 */
export async function loginWithCredentials(
  email: string,
  password: string,
): Promise<{ success: boolean; token?: string; user?: AuthUser; error?: string }> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  })
  if (!user || !user.active) {
    return { success: false, error: 'Invalid email or password' }
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return { success: false, error: 'Invalid email or password' }
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  await db.session.create({
    data: { userId: user.id, token, expiresAt },
  })

  return {
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      organizationId: user.organizationId,
    },
  }
}

/**
 * Set the session cookie on the response.
 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
}

/**
 * Clear the session cookie and delete the session from the DB.
 */
export async function clearSession() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (token) {
      await db.session.deleteMany({ where: { token } })
    }
    cookieStore.delete(SESSION_COOKIE)
  } catch {
    // ignore
  }
}

/**
 * Role hierarchy — used for permission checks.
 * Higher roles inherit lower role permissions.
 */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  Viewer: ['read'],
  Accountant: ['read', 'create_journal', 'edit_draft_journal', 'submit_journal'],
  Approver: ['read', 'create_journal', 'edit_draft_journal', 'submit_journal', 'approve_journal', 'reject_journal'],
  Controller: [
    'read', 'create_journal', 'edit_draft_journal', 'submit_journal',
    'approve_journal', 'reject_journal', 'post_journal', 'reverse_journal',
    'close_period', 'reopen_period',
  ],
  Administrator: [
    'read', 'create_journal', 'edit_draft_journal', 'submit_journal',
    'approve_journal', 'reject_journal', 'post_journal', 'reverse_journal',
    'close_period', 'reopen_period',
    'manage_users', 'manage_organization',
  ],
  Auditor: ['read', 'view_audit_log'],
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false
}
