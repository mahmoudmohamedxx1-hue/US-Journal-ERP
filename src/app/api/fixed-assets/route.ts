import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext, logAudit } from '@/lib/api'

// GET /api/fixed-assets
export async function GET() {
  const ctx = await getSystemContext()
  const assets = await db.fixedAsset.findMany({
    where: { organizationId: ctx.organizationId },
    include: { account: true, depreciationRecords: { orderBy: { period: 'desc' } } },
    orderBy: { assetNumber: 'asc' },
  })
  return ok({ fixedAssets: assets })
}

// POST /api/fixed-assets — create a fixed asset + auto-calculate depreciation schedule
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { assetNumber, name, description, accountId, purchaseDate, purchaseCost, salvageValue, usefulLifeMonths, depreciationMethod } = body

    if (!assetNumber || !name || !accountId || !purchaseDate || !purchaseCost) {
      return err('assetNumber, name, accountId, purchaseDate, purchaseCost are required', 422, undefined, 'VALIDATION_ERROR')
    }

    const cost = Math.round(Number(purchaseCost) * 100)
    const salvage = salvageValue ? Math.round(Number(salvageValue) * 100) : 0
    const lifeMonths = Number(usefulLifeMonths) || 60

    const asset = await db.fixedAsset.create({
      data: {
        organizationId: ctx.organizationId,
        assetNumber,
        name,
        description: description || null,
        accountId,
        purchaseDate: new Date(purchaseDate),
        purchaseCost: cost,
        salvageValue: salvage,
        usefulLifeMonths: lifeMonths,
        depreciationMethod: depreciationMethod || 'straight-line',
        currentBookValue: cost,
        accumulatedDepreciation: 0,
        status: 'Active',
      },
      include: { account: true },
    })

    await logAudit({ action: 'CREATE_FIXED_ASSET', entityType: 'FixedAsset', entityId: asset.id, description: `Created fixed asset ${assetNumber}: ${name} (cost: ${cost} cents)` })

    return ok({ fixedAsset: asset }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
