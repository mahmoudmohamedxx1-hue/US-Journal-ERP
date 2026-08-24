'use client'

import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center', className)}>
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {description && (
          <div className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</div>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
