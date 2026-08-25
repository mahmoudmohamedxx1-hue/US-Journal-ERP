import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/products
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const search = url.searchParams.get('q')
  const activeOnly = url.searchParams.get('active') !== '0'

  const where: Record<string, unknown> = { organizationId: ctx.organizationId }
  if (activeOnly) where.active = true
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { sku: { contains: search } },
      { category: { contains: search } },
    ]
  }

  const products = await db.product.findMany({
    where,
    orderBy: { name: 'asc' },
  })
  return ok({ products })
}

// POST /api/products
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { sku, name, description, category, unit, costPrice, salePrice, stockQuantity, reorderPoint } = body

    if (!sku) return err('SKU is required', 422, undefined, 'VALIDATION_ERROR')
    if (!name) return err('Product name is required', 422, undefined, 'VALIDATION_ERROR')

    const existing = await db.product.findFirst({ where: { organizationId: ctx.organizationId, sku } })
    if (existing) return err(`SKU ${sku} already exists`, 409, undefined, 'DUPLICATE')

    const product = await db.product.create({
      data: {
        organizationId: ctx.organizationId,
        sku,
        name,
        description: description || null,
        category: category || null,
        unit: unit || 'each',
        costPrice: costPrice ? Math.round(Number(costPrice) * 100) : 0,
        salePrice: salePrice ? Math.round(Number(salePrice) * 100) : 0,
        stockQuantity: Number(stockQuantity) || 0,
        reorderPoint: Number(reorderPoint) || 0,
        active: true,
      },
    })
    return ok({ product }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create product', 500, undefined, 'INTERNAL_ERROR')
  }
}
