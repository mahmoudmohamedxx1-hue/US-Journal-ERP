/**
 * Shared API helpers — single-tenant demo org for the US Journal ERP.
 * In a production multi-tenant deployment these would derive the orgId
 * from the authenticated session.
 */
import { db } from './db'

export const DEMO_ORG_ID = 'org-us-journal'

// Hard-coded "current user" for demo purposes (Controller role so they can post).
// In production, derive from session via Better Auth.
export const DEMO_USER_ID = 'u-ctrl'

export async function getCurrentOrg() {
  return db.organization.findUniqueOrThrow({ where: { id: DEMO_ORG_ID } })
}

export async function getCurrentUser() {
  return db.user.findUniqueOrThrow({ where: { id: DEMO_USER_ID } })
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

export function ok<T>(data: T, status = 200) {
  return Response.json(data, { status })
}

export function err(message: string, status = 400, details?: unknown) {
  return Response.json({ error: message, details }, { status })
}

export async function logAudit(opts: {
  action: string
  entityType: string
  entityId?: string
  description: string
  userId?: string
}) {
  try {
    await db.auditLog.create({
      data: {
        organizationId: DEMO_ORG_ID,
        userId: opts.userId ?? DEMO_USER_ID,
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
