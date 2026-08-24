import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/accounts — list all accounts (optionally filtered by type / active)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const activeOnly = url.searchParams.get('active') === '1'

  const where: Record<string, unknown> = { organizationId: user.organizationId }
  if (type) where.accountType = type
  if (activeOnly) where.active = true

  const accounts = await db.account.findMany({
    where,
    orderBy: [{ code: 'asc' }],
    include: { parent: true },
  })

  return ok({ accounts })
}

// POST /api/accounts — create new account
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const body = await req.json().catch(() => ({}))
  const { code, name, accountType, subType, parentId, normalBalance, taxBehavior, description } = body

  if (!code || !name || !accountType) {
    return err('code, name, accountType are required', 422)
  }

  const exists = await db.account.findFirst({
    where: { organizationId: user.organizationId, code: String(code) },
  })
  if (exists) return err(`Account code ${code} already exists`, 409)

  const acct = await db.account.create({
    data: {
      organizationId: user.organizationId,
      code: String(code),
      name: String(name),
      accountType: String(accountType),
      subType: subType ? String(subType) : null,
      parentId: parentId ? String(parentId) : null,
      normalBalance: normalBalance || 'Debit',
      taxBehavior: taxBehavior || null,
      description: description || null,
    },
  })
  return ok({ account: acct }, 201)
}
