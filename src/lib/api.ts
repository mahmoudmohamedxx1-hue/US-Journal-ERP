/**
 * Shared API helpers — session-aware auth + structured JSON error responses.
 *
 * IMPORTANT: This is a REAL ERP. There is no demo org fallback.
 * Every API route requires authentication and resolves the org from
 * the authenticated session. The Setup Wizard is the only way to
 * create the organization and first admin user.
 */
import { db } from './db'
import { getCurrentUser, type AuthUser, type Role } from './auth'

/**
 * Returns the currently-authenticated user, or null.
 * In a real ERP, every API route should call requireUser() or requireRole()
 * — there is no DEMO_ORG_ID fallback.
 */
export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  return getCurrentUser()
}

/**
 * Returns the current user's organization.
 * Throws if not authenticated — callers should use requireUser() first.
 */
export async function getCurrentOrg() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Not authenticated — call requireUser() before getCurrentOrg()')
  }
  return db.organization.findUniqueOrThrow({ where: { id: user.organizationId } })
}

/**
 * Returns the current user's organization ID.
 * Throws if not authenticated.
 */
export async function getCurrentOrgId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Not authenticated — call requireUser() before getCurrentOrgId()')
  }
  return user.organizationId
}

/**
 * Returns the current user's ID.
 * Throws if not authenticated.
 */
export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Not authenticated — call requireUser() before getCurrentUserId()')
  }
  return user.id
}

export function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0)
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Success response helper */
export function ok<T>(data: T, status = 200) {
  return Response.json(data, { status })
}

/**
 * Structured error response.
 * Always returns: { error: string, code: string, details?: any }
 * HTTP status defaults to 400.
 */
export function err(
  message: string,
  status = 400,
  details?: unknown,
  code = 'BAD_REQUEST',
) {
  return Response.json(
    { error: message, code, details },
    { status },
  )
}

/** Unauthenticated response — use when no session */
export function unauthorized(message = 'Unauthorized') {
  return err(message, 401, undefined, 'UNAUTHORIZED')
}

/** Forbidden response — use when user lacks the required role */
export function forbidden(requiredRole: string, userRole?: string) {
  return err(
    `Forbidden — requires role: ${requiredRole}`,
    403,
    { requiredRole, userRole },
    'FORBIDDEN',
  )
}

/**
 * Audit log helper — uses the session user when available.
 * If no session (e.g. setup endpoint), pass userId + organizationId
 * explicitly via opts.
 */
export async function logAudit(opts: {
  action: string
  entityType: string
  entityId?: string
  description: string
  userId?: string
  organizationId?: string
}) {
  try {
    let userId = opts.userId
    let orgId = opts.organizationId
    if (!userId || !orgId) {
      const user = await getCurrentUser()
      userId = userId ?? user?.id ?? 'system'
      orgId = orgId ?? user?.organizationId
    }
    if (!orgId) {
      // No org context — skip audit log silently (e.g. during setup)
      return
    }
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        userId,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        description: opts.description,
      },
    })
  } catch {
    // Never fail the main op due to audit log failure
  }
}

export type { AuthUser, Role }
