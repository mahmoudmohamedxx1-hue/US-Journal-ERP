import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/banking — list bank accounts
export async function GET() {
  const ctx = await getSystemContext()
  const accounts = await db.bankAccount.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { accountName: 'asc' },
    include: { transactions: { orderBy: { date: 'desc' }, take: 20 } },
  })
  return ok({ accounts })
}

// POST /api/banking — create a new bank account
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { accountName, bankName, accountNumber, accountType, currency, balance } = body

    if (!accountName) return err('Account name is required', 422, undefined, 'VALIDATION_ERROR')

    const account = await db.bankAccount.create({
      data: {
        organizationId: ctx.organizationId,
        accountName,
        bankName: bankName || null,
        accountNumber: accountNumber || '—',
        accountType: accountType || 'Checking',
        currency: currency || 'EGP',
        balance: balance ? Math.round(Number(balance) * 100) : 0,
        active: true,
      },
    })
    return ok({ account }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed to create bank account', 500, undefined, 'INTERNAL_ERROR')
  }
}
