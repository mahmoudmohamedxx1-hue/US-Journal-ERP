/**
 * Shared API helpers — session-aware auth + structured JSON error responses.
 */
import { db } from './db'
import { getCurrentUser, type AuthUser, type Role } from './auth'

// Fallback org ID (used only when no session — e.g. login page SSR).
export const DEMO_ORG_ID = 'org-us-journal'

export async function getCurrentOrg() {
  const user = await getCurrentUser()
  const orgId = user?.organizationId ?? DEMO_ORG_ID
  return db.organization.findUniqueOrThrow({ where: { id: orgId } })
}

/**
 * Returns the currently-authenticated user, or null.
 */
export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  return getCurrentUser()
}

/**
 * Returns the current user's organization ID.
 * Falls back to the demo org if no session (SSR on login page).
 */
export async function getCurrentOrgId(): Promise<string> {
  const user = await getCurrentUser()
  return user?.organizationId ?? DEMO_ORG_ID
}

/**
 * Returns the current user's ID, or null if not authenticated.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}

// Backward-compat export (deprecated — use getCurrentUserId() instead).
export const DEMO_USER_ID = 'u-ctrl'

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
 * Audit log helper — uses the session user when available,
 * falls back to a system user otherwise.
 */
export async function logAudit(opts: {
  action: string
  entityType: string
  entityId?: string
  description: string
  userId?: string
}) {
  try {
    const user = await getCurrentUser()
    const userId = opts.userId ?? user?.id ?? 'system'
    const orgId = user?.organizationId ?? DEMO_ORG_ID
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
