import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { ok, err } from '@/lib/api'
import { setupSchema, validate } from '@/lib/validation'

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

    // Validate input with Zod schema
    const validation = validate(setupSchema, body)
    if (!validation.success) {
      return err(validation.error, 422, validation.details, 'VALIDATION_ERROR')
    }
    const { organizationName, adminName, adminEmail, adminPassword } = validation.data

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

    // --- Create organization + admin user + membership in a transaction ---
    // Atomic: if any step fails, the whole setup rolls back — no partial state.
    const { org, adminUser } = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: organizationName,
          legalName: organizationName,
          taxId: null,
          currency: 'EGP',
          baseCurrency: 'EGP',
        },
      })

      const passwordHash = await bcrypt.hash(adminPassword, 10)
      const adminUser = await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          passwordHash,
          role: 'Administrator',
          organizationId: org.id,
          active: true,
        },
      })

      await tx.membership.create({
        data: {
          userId: adminUser.id,
          organizationId: org.id,
          role: 'Administrator',
        },
      })

      // Audit log entry for setup completion
      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          userId: adminUser.id,
          action: 'SETUP_COMPLETE',
          entityType: 'Organization',
          entityId: org.id,
          description: `Initial setup — organization '${org.name}' created with admin user '${adminUser.email}'`,
        },
      })

      return { org, adminUser }
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
