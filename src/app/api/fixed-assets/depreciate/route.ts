import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext, logAudit } from '@/lib/api'

// POST /api/fixed-assets/depreciate — run monthly depreciation for all active assets
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { period } = body // e.g. "2026-08"

    if (!period) return err('period is required (e.g. "2026-08")', 422, undefined, 'VALIDATION_ERROR')

    const assets = await db.fixedAsset.findMany({
      where: { organizationId: ctx.organizationId, status: 'Active' },
      include: { account: true },
    })

    const results: Array<{ assetNumber: string; name: string; depreciationAmount: number; bookValueAfter: number; fullyDepreciated: boolean }> = []

    for (const asset of assets) {
      // Check if already depreciated for this period
      const existing = await db.depreciationRecord.findFirst({
        where: { fixedAssetId: asset.id, period },
      })
      if (existing) {
        results.push({ assetNumber: asset.assetNumber, name: asset.name, depreciationAmount: 0, bookValueAfter: asset.currentBookValue, fullyDepreciated: false })
        continue
      }

      // Calculate depreciation
      if (asset.depreciationMethod === 'straight-line') {
        const monthlyDepreciation = Math.round((asset.purchaseCost - asset.salvageValue) / asset.usefulLifeMonths)
        if (monthlyDepreciation <= 0 || asset.currentBookValue <= asset.salvageValue) {
          results.push({ assetNumber: asset.assetNumber, name: asset.name, depreciationAmount: 0, bookValueAfter: asset.currentBookValue, fullyDepreciated: asset.currentBookValue <= asset.salvageValue })
          continue
        }

        const newAccumulated = asset.accumulatedDepreciation + monthlyDepreciation
        const newBookValue = asset.purchaseCost - newAccumulated
        const fullyDepreciated = newBookValue <= asset.salvageValue

        await db.$transaction(async (tx) => {
          // Create depreciation record
          await tx.depreciationRecord.create({
            data: {
              fixedAssetId: asset.id,
              period,
              depreciationAmount: monthlyDepreciation,
              bookValueAfter: Math.max(newBookValue, asset.salvageValue),
            },
          })

          // Update asset
          await tx.fixedAsset.update({
            where: { id: asset.id },
            data: {
              accumulatedDepreciation: newAccumulated,
              currentBookValue: Math.max(newBookValue, asset.salvageValue),
              status: fullyDepreciated ? 'Fully Depreciated' : 'Active',
            },
          })

          // Create journal entry (if accounts exist)
          const depAccount = await tx.account.findFirst({
            where: { organizationId: ctx.organizationId, code: '6800' },
          })
          const accumDepAccount = await tx.account.findFirst({
            where: { organizationId: ctx.organizationId, code: { startsWith: '12' } },
          })

          if (depAccount && accumDepAccount) {
            const count = await tx.journal.count({ where: { organizationId: ctx.organizationId } })
            const journalNumber = `JE-${period.split('-')[0]}-${String(count + 1).padStart(4, '0')}`
            const j = await tx.journal.create({
              data: {
                organizationId: ctx.organizationId,
                journalNumber,
                journalDate: new Date(period + '-01'),
                source: 'Depreciation',
                reference: `DEP-${period}-${asset.assetNumber}`,
                description: `Depreciation for ${asset.name} (${asset.assetNumber}) — ${period}`,
                currency: 'EGP',
                exchangeRate: 100,
                status: 'Posted',
                totalDebit: monthlyDepreciation,
                totalCredit: monthlyDepreciation,
                createdById: ctx.userId,
                postedById: ctx.userId,
                postedAt: new Date(),
                postingDate: new Date(),
              },
            })
            await tx.journalLine.createMany({
              data: [
                { journalId: j.id, lineNumber: 1, accountId: depAccount.id, description: `Depreciation — ${asset.name}`, debit: monthlyDepreciation, credit: 0 },
                { journalId: j.id, lineNumber: 2, accountId: accumDepAccount.id, description: `Accumulated depreciation — ${asset.name}`, debit: 0, credit: monthlyDepreciation },
              ],
            })
            await tx.depreciationRecord.updateMany({
              where: { fixedAssetId: asset.id, period },
              data: { journalId: j.id },
            })
          }
        })

        results.push({
          assetNumber: asset.assetNumber,
          name: asset.name,
          depreciationAmount: monthlyDepreciation,
          bookValueAfter: Math.max(newBookValue, asset.salvageValue),
          fullyDepreciated,
        })
      }
    }

    const totalDepreciation = results.reduce((s, r) => s + r.depreciationAmount, 0)

    await logAudit({
      action: 'DEPRECIATION_RUN',
      entityType: 'FixedAsset',
      description: `Depreciation run for ${period} — ${assets.length} assets, total: ${totalDepreciation} cents`,
    })

    return ok({
      period,
      assetsProcessed: results.length,
      totalDepreciation,
      details: results,
    })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Depreciation run failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
