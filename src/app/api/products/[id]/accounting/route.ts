import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { getProductAccounting } from '@/lib/odoo-complete'
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getProductAccounting(id)
  if (!result) return err('Product not found', 404)
  return ok({ accounting: result })
}
