import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'
export async function GET() { const ctx = await getSystemContext(); const subs = await db.subsidiary.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { name: 'asc' } }); return ok({ subsidiaries: subs }) }
export async function POST(req: NextRequest) { try { const ctx = await getSystemContext(); const b = await req.json(); if (!b.name) return err('Name required', 422); const s = await db.subsidiary.create({ data: { organizationId: ctx.organizationId, name: b.name, legalName: b.legalName||null, taxId: b.taxId||null, currency: b.currency||'EGP' } }); return ok({ subsidiary: s }, 201) } catch (e) { return err(e instanceof Error?e.message:'Failed', 500) } }
