/**
 * Shared API helpers — NO AUTH REQUIRED (current version).
 *
 * The app auto-creates a default organization + admin user on first
 * database access. All API routes use getSystemContext() to get the
 * org/user context without requiring a session cookie.
 *
 * This simplifies the desktop app: no login screen, no setup wizard,
 * just open the app and start working.
 */
import { db } from './db'
import bcrypt from 'bcryptjs'

export interface SystemContext {
  organizationId: string
  userId: string
  userName: string
  userEmail: string
  userRole: string
}

let cachedContext: SystemContext | null = null

/**
 * Returns the system context (org + user) — auto-creates if missing.
 * No authentication required.
 *
 * On first call: creates a default org "US Journal ERP" and admin user
 * "admin@local" with a random password (since no one needs to log in).
 * Subsequent calls return the cached context.
 */
export async function getSystemContext(): Promise<SystemContext> {
  if (cachedContext) return cachedContext

  // Find or create the organization
  let org = await db.organization.findFirst()
  if (!org) {
    org = await db.organization.create({
      data: {
        name: 'US Journal ERP',
        legalName: 'US Journal ERP',
        currency: 'EGP',
        baseCurrency: 'EGP',
      },
    })
    console.log(`[api] Auto-created organization: ${org.name}`)
  }

  // Find or create the admin user
  let user = await db.user.findFirst({ where: { organizationId: org.id } })
  if (!user) {
    const passwordHash = await bcrypt.hash(
      Math.random().toString(36).slice(2) + Date.now().toString(36),
      10,
    )
    user = await db.user.create({
      data: {
        email: 'admin@local',
        name: 'Administrator',
        passwordHash,
        role: 'Administrator',
        organizationId: org.id,
        active: true,
      },
    })
    console.log(`[api] Auto-created admin user: ${user.email}`)
  }

  cachedContext = {
    organizationId: org.id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userRole: user.role,
  }

  return cachedContext
}

/**
 * Returns the current user's organization ID — no auth required.
 */
export async function getCurrentOrgId(): Promise<string> {
  const ctx = await getSystemContext()
  return ctx.organizationId
}

/**
 * Returns the current user's ID — no auth required.
 */
export async function getCurrentUserId(): Promise<string> {
  const ctx = await getSystemContext()
  return ctx.userId
}

/**
 * Returns the current user's organization.
 */
export async function getCurrentOrg() {
  const ctx = await getSystemContext()
  return db.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } })
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
 * Audit log helper — uses the system context (auto-created org + admin).
 * Implements hash-chain immutability: each entry's hash = SHA256(prevHash + content).
 * If any entry is tampered with, the chain breaks and detection is possible.
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
    const ctx = await getSystemContext()
    const userId = opts.userId ?? ctx.userId
    const orgId = opts.organizationId ?? ctx.organizationId

    // Get the previous audit log entry's hash
    const prevEntry = await db.auditLog.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    })
    const prevHash = prevEntry?.hash || null

    // Create the entry
    const entry = await db.auditLog.create({
      data: {
        organizationId: orgId,
        userId,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        description: opts.description,
        prevHash,
      },
    })

    // Compute hash: SHA256(id + action + entityType + description + prevHash)
    const { createHash } = await import('crypto')
    const content = `${entry.id}|${opts.action}|${opts.entityType}|${opts.description}|${prevHash || ''}`
    const hash = createHash('sha256').update(content).digest('hex')

    // Update the entry with its hash
    await db.auditLog.update({
      where: { id: entry.id },
      data: { hash },
    })
  } catch {
    // Never fail the main op due to audit log failure
  }
}

export type { AuthUser, Role }
