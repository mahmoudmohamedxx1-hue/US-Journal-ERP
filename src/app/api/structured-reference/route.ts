import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { generateStructuredReference, isValidStructuredReference } from '@/lib/odoo-complete'
export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.reference) return err('reference is required', 422)
  const ref = generateStructuredReference(String(body.reference))
  return ok({ structuredReference: ref, valid: isValidStructuredReference(ref) })
}
