import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { DEMO_ORG_ID, ok } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"

// GET /api/audit-log — most recent first, paginated
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const pageSize = parseInt(url.searchParams.get('pageSize') || '50')
  const action = url.searchParams.get('action')
  const entityType = url.searchParams.get('entityType')

  const where: Record<string, unknown> = { organizationId: DEMO_ORG_ID }
  if (action) where.action = action
  if (entityType) where.entityType = entityType

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return ok({
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}
