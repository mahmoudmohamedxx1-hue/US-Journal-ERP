import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'
import { extractInvoice } from '@/lib/ai/glm'

// GET /api/ocr-scan — list all OCR scans
export async function GET() {
  const ctx = await getSystemContext()
  const scans = await db.ocrScan.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, fileName: true, status: true, extractedData: true, entityType: true, entityId: true, createdAt: true },
  })
  return ok({ ocrScans: scans })
}

// POST /api/ocr-scan — upload image, run GLM-4V extraction
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const b = await req.json()
    if (!b.fileName || !b.fileData) return err('fileName, fileData (base64) required', 422)

    const scan = await db.ocrScan.create({
      data: {
        organizationId: ctx.organizationId,
        fileName: b.fileName,
        mimeType: b.mimeType || 'image/png',
        fileData: b.fileData,
        status: 'Pending',
      },
    })

    // Run extraction via the unified GLM module
    const result = await extractInvoice(b.fileData, b.mimeType || 'image/png')

    if (result.ok && result.data) {
      await db.ocrScan.update({
        where: { id: scan.id },
        data: { extractedData: JSON.stringify(result.data, null, 2), status: 'Processed' },
      })
      return ok({
        ocrScan: {
          id: scan.id,
          fileName: b.fileName,
          status: 'Processed',
          extractedData: JSON.stringify(result.data, null, 2),
          parsed: result.data,
        },
      }, 201)
    } else {
      await db.ocrScan.update({ where: { id: scan.id }, data: { status: 'Failed' } })
      return ok({
        ocrScan: {
          id: scan.id,
          fileName: b.fileName,
          status: 'Failed',
          error: result.error || 'OCR extraction failed — saved for manual review',
        },
      }, 201)
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500)
  }
}
