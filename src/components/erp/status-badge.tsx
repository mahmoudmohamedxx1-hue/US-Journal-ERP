'use client'

import { cn } from '@/lib/utils'
import { STATUS_META, type JournalStatus } from '@/lib/format'

interface StatusBadgeProps {
  status: JournalStatus | string
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({ status, size = 'sm', className }: StatusBadgeProps) {
  const meta = STATUS_META[status as JournalStatus] ?? STATUS_META.Draft
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        meta.bg,
        meta.color,
        className,
      )}
      title={meta.description}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  )
}
