import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// PUT /api/organization — actually save organization settings to DB
export async function PUT(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json()
    const { name, legalName, taxId, currency, baseCurrency } = body

    const updated = await db.organization.update({
      where: { id: ctx.organizationId },
      data: {
        ...(name && { name }),
        ...(legalName !== undefined && { legalName }),
        ...(taxId !== undefined && { taxId }),
        ...(currency && { currency }),
        ...(baseCurrency && { baseCurrency }),
      },
    })

    return ok({ organization: updated })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
