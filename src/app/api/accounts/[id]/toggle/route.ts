import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// PATCH /api/accounts/[id]/toggle — toggle active state
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSystemContext()
    const { id } = await params
    const body = await req.json()
    const { active } = body

    const updated = await db.account.update({
      where: { id },
      data: { active: !!active },
    })
    return ok({ account: updated })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
