import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { convertUom, UNITS_OF_MEASURE } from '@/lib/odoo-complete'
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const quantity = parseFloat(url.searchParams.get('quantity') || '1')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (!from || !to) return err('from and to are required', 422)
  const result = convertUom(quantity, from, to)
  return ok({ quantity: result, from, to })
}
