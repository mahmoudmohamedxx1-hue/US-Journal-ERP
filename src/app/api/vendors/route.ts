import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok, err } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/vendors
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const url = new URL(req.url)
  const includeBills = url.searchParams.get('withBills') === '1'
  const activeOnly = url.searchParams.get('active') !== '0'

  const where: Record<string, unknown> = { organizationId: DEMO_ORG_ID }
  if (activeOnly) where.active = true

  const vendors = await db.vendor.findMany({
    where,
    orderBy: { name: 'asc' },
    include: includeBills ? { bills: true } : false,
  })

  // Aging buckets
  const today = new Date('2026-08-24')
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 }
  for (const v of vendors) {
    if (includeBills && v.bills) {
      for (const b of v.bills) {
        if (b.amountPaid >= b.amount) continue
        const remaining = b.amount - b.amountPaid
        const days = Math.floor((today.getTime() - b.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        if (days < 0) buckets.current += remaining
        else if (days <= 30) buckets.d30 += remaining
        else if (days <= 60) buckets.d60 += remaining
        else if (days <= 90) buckets.d90 += remaining
        else buckets.d90plus += remaining
      }
    }
  }

  return ok({ vendors, aging: buckets })
}
