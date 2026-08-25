import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/documents — list documents (optionally filtered by entityType)
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const entityType = url.searchParams.get('entityType')
  const entityId = url.searchParams.get('entityId')

  const where: Record<string, unknown> = { organizationId: ctx.organizationId }
  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = entityId

  const docs = await db.document.findMany({
    where,
    orderBy: { uploadedAt: 'desc' },
    select: { id: true, fileName: true, fileSize: true, mimeType: true, entityType: true, entityId: true, uploadedAt: true },
  })
  return ok({ documents: docs })
}

// POST /api/documents — upload a document (base64-encoded)
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { fileName, mimeType, fileData, entityType, entityId } = body

    if (!fileName || !fileData) return err('fileName and fileData are required', 422, undefined, 'VALIDATION_ERROR')

    // Estimate file size from base64 data
    const fileSize = Math.round((String(fileData).length * 3) / 4)

    const doc = await db.document.create({
      data: {
        organizationId: ctx.organizationId,
        fileName,
        fileSize,
        mimeType: mimeType || 'application/octet-stream',
        fileData: String(fileData),
        entityType: entityType || 'General',
        entityId: entityId || null,
      },
      select: { id: true, fileName: true, fileSize: true, mimeType: true, entityType: true, entityId: true, uploadedAt: true },
    })
    return ok({ document: doc }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to upload document', 500, undefined, 'INTERNAL_ERROR')
  }
}
