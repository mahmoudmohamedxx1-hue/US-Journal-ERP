'use client'

import { cn } from '@/lib/utils'

interface BalanceIndicatorProps {
  debit: number
  credit: number
  className?: string
}

export function BalanceIndicator({ debit, credit, className }: BalanceIndicatorProps) {
  const diff = debit - credit
  const balanced = Math.abs(diff) < 0.005

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border px-3 py-2',
        balanced
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-amber-200 bg-amber-50',
        className,
      )}
    >
      <div className="flex items-center gap-4 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Debits
          </div>
          <div className="font-mono font-medium tabular-nums">
            {debit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="text-muted-foreground">−</div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Credits
          </div>
          <div className="font-mono font-medium tabular-nums">
            {credit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="text-muted-foreground">=</div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Difference
          </div>
          <div
            className={cn(
              'font-mono font-semibold tabular-nums',
              balanced ? 'text-emerald-700' : 'text-amber-700',
            )}
          >
            {diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
      <div className="ml-auto">
        {balanced ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Balanced
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Out of balance
          </span>
        )}
      </div>
    </div>
  )
}
