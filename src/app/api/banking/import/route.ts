import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { importBankStatement } from '@/lib/bank-import'

// POST /api/banking/import — import bank statement CSV
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json()
    const { bankAccountId, csvContent } = body
    if (!bankAccountId) return err('bankAccountId is required', 422, undefined, 'VALIDATION_ERROR')
    if (!csvContent) return err('csvContent is required', 422, undefined, 'VALIDATION_ERROR')
    const result = await importBankStatement(bankAccountId, csvContent, ctx.organizationId, ctx.userId)
    return ok({ result }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
