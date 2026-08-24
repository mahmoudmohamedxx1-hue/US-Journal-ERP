import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { ok, err } from '@/lib/api'

/**
 * POST /api/setup/initialize
 *
 * First-run setup. Creates the organization and an administrator user.
 *
 * This is a REAL ERP — no demo data is seeded. The administrator can
 * configure the chart of accounts, vendors, customers, etc. manually
 * after logging in.
 *
 * Body:
 *   {
 *     organizationName: string,
 *     adminName: string,
 *     adminEmail: string,
 *     adminPassword: string,   // 8+ chars
 *   }
 *
 * Returns:
 *   { success: true, organization: {...}, adminUser: {...} }
 *
 * Idempotency: returns 409 if any user already exists.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { organizationName, adminName, adminEmail, adminPassword } = body

    // --- Validate inputs ---
    if (!organizationName || !adminName || !adminEmail || !adminPassword) {
      return err(
        'organizationName, adminName, adminEmail, adminPassword are required',
        422,
        undefined,
        'VALIDATION_ERROR',
      )
    }

    if (typeof adminPassword !== 'string' || adminPassword.length < 8) {
      return err(
        'Admin password must be at least 8 characters',
        422,
        undefined,
        'VALIDATION_ERROR',
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(adminEmail)) {
      return err('Admin email is invalid', 422, undefined, 'VALIDATION_ERROR')
    }

    // --- Idempotency check: don't allow re-initialization ---
    const existingUserCount = await db.user.count()
    if (existingUserCount > 0) {
      return err(
        'Database is already initialized — use the login screen instead',
        409,
        undefined,
        'ALREADY_INITIALIZED',
      )
    }

    // --- Create organization ---
    const org = await db.organization.create({
      data: {
        name: String(organizationName),
        legalName: String(organizationName),
        taxId: null,
        currency: 'USD',
        baseCurrency: 'USD',
      },
    })

    // --- Create admin user with bcrypt-hashed password ---
    const passwordHash = await bcrypt.hash(String(adminPassword), 10)
    const adminUser = await db.user.create({
      data: {
        email: String(adminEmail).toLowerCase().trim(),
        name: String(adminName),
        passwordHash,
        role: 'Administrator',
        organizationId: org.id,
        active: true,
      },
    })
    await db.membership.create({
      data: {
        userId: adminUser.id,
        organizationId: org.id,
        role: 'Administrator',
      },
    })

    // --- Audit log entry ---
    await db.auditLog.create({
      data: {
        organizationId: org.id,
        userId: adminUser.id,
        action: 'SETUP_COMPLETE',
        entityType: 'Organization',
        entityId: org.id,
        description: `Initial setup — organization '${org.name}' created with admin user '${adminUser.email}'`,
      },
    })

    return ok({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        currency: org.currency,
      },
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
      },
    })
  } catch (e) {
    console.error('[setup/initialize] Error:', e)
    return err(
      e instanceof Error ? e.message : 'Setup failed',
      500,
      undefined,
      'INTERNAL_ERROR',
    )
  }
}
