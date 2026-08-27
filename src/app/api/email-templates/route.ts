import { NextRequest } from 'next/server'
import { ok } from '@/lib/api'
import { EMAIL_TEMPLATES, renderEmailTemplate } from '@/lib/odoo-complete'
export async function GET() { return ok({ templates: EMAIL_TEMPLATES }) }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { templateId, variables } = body
  const template = EMAIL_TEMPLATES.find(t => t.id === templateId)
  if (!template) return Response.json({ error: 'Template not found' }, { status: 404 })
  return ok({ rendered: renderEmailTemplate(template, variables) })
}
