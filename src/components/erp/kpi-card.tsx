'use client'

import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string
  hint?: string
  trend?: 'up' | 'down' | 'flat'
  trendValue?: string
  icon?: React.ReactNode
  variant?: 'default' | 'accent' | 'danger' | 'success'
}

export function KpiCard({
  label,
  value,
  hint,
  trend,
  trendValue,
  icon,
  variant = 'default',
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 shadow-sm',
        variant === 'accent' && 'border-accent/30 bg-accent/5',
        variant === 'danger' && 'border-destructive/30 bg-destructive/5',
        variant === 'success' && 'border-emerald-200 bg-emerald-50',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </div>
      {(hint || trend) && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          {trend && trendValue && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                trend === 'up' && 'text-emerald-600',
                trend === 'down' && 'text-red-600',
                trend === 'flat' && 'text-muted-foreground',
              )}
            >
              {trend === 'up' && '↑'}
              {trend === 'down' && '↓'}
              {trend === 'flat' && '→'}
              {trendValue}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  )
}
