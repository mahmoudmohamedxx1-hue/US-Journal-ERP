import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/custom-fields — list custom fields (optionally filtered by entityType)
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const entityType = url.searchParams.get('entityType')

  const where: Record<string, unknown> = { organizationId: ctx.organizationId }
  if (entityType) where.entityType = entityType

  const fields = await db.customField.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
    include: { values: true },
  })
  return ok({ customFields: fields })
}

// POST /api/custom-fields — create a custom field
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { entityType, fieldName, fieldType, fieldOptions, isRequired } = body

    if (!entityType || !fieldName) {
      return err('entityType and fieldName are required', 422, undefined, 'VALIDATION_ERROR')
    }

    const existing = await db.customField.findFirst({
      where: { organizationId: ctx.organizationId, entityType, fieldName },
    })
    if (existing) return err(`Field ${fieldName} already exists for ${entityType}`, 409, undefined, 'DUPLICATE')

    const field = await db.customField.create({
      data: {
        organizationId: ctx.organizationId,
        entityType,
        fieldName,
        fieldType: fieldType || 'text',
        fieldOptions: fieldOptions ? JSON.stringify(fieldOptions) : null,
        isRequired: !!isRequired,
      },
    })
    return ok({ customField: field }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create custom field', 500, undefined, 'INTERNAL_ERROR')
  }
}
