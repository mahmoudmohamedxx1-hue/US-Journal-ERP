import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'

// GET /api/notifications
export async function GET() {
  const ctx = await getSystemContext()
  const notifications = await db.notification.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  const unread = notifications.filter(n => !n.read).length
  return ok({ notifications, unreadCount: unread })
}

// POST /api/notifications — create a notification
export async function POST(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { title, message, type, entityType, entityId } = body

    if (!title || !message) return err('title and message are required', 422, undefined, 'VALIDATION_ERROR')

    const notif = await db.notification.create({
      data: {
        organizationId: ctx.organizationId,
        title,
        message,
        type: type || 'info',
        entityType: entityType || null,
        entityId: entityId || null,
      },
    })
    return ok({ notification: notif }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}

// PATCH /api/notifications — mark as read
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getSystemContext()
    const body = await req.json().catch(() => ({}))
    const { notificationId, markAllRead } = body

    if (markAllRead) {
      await db.notification.updateMany({
        where: { organizationId: ctx.organizationId, read: false },
        data: { read: true },
      })
      return ok({ success: true, message: 'All notifications marked as read' })
    }

    if (!notificationId) return err('notificationId or markAllRead=true is required', 422, undefined, 'VALIDATION_ERROR')
    await db.notification.update({ where: { id: notificationId }, data: { read: true } })
    return ok({ success: true })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500, undefined, 'INTERNAL_ERROR')
  }
}
