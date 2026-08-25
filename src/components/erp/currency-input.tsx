'use client'

import { forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string | null | undefined
  onValueChange?: (value: number) => void
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  align?: 'left' | 'right'
  currency?: string
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, onChange, align = 'right', className, currency = 'EGP', ...rest }, ref) => {
    const displayValue =
      value === null || value === undefined || value === ''
        ? ''
        : typeof value === 'string'
          ? value
          : String(value)

    // Get currency symbol from our supported currencies
    const symbol = currency === 'EGP' ? 'E£'
      : currency === 'USD' ? '$'
      : currency === 'EUR' ? '€'
      : currency === 'GBP' ? '£'
      : currency === 'SAR' ? '﷼'
      : currency === 'AED' ? 'د.إ'
      : currency

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
          {symbol}
        </span>
        <Input
          ref={ref}
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={displayValue}
          onChange={(e) => {
            const num = e.target.value === '' ? 0 : parseFloat(e.target.value)
            onValueChange?.(num || 0)
            onChange?.(e)
          }}
          className={cn(
            'font-mono text-sm',
            align === 'right' ? 'text-right pr-2' : 'text-left pl-7',
            align === 'right' && 'pl-7',
            className,
          )}
          {...rest}
        />
      </div>
    )
  },
)
CurrencyInput.displayName = 'CurrencyInput'
