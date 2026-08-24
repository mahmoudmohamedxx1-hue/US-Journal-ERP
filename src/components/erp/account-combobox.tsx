'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type AccountOption = {
  id: string
  code: string
  name: string
  accountType: string
  subType?: string | null
}

interface AccountComboboxProps {
  accounts: AccountOption[]
  value?: string // account id
  onChange: (accountId: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function AccountCombobox({
  accounts,
  value,
  onChange,
  placeholder = 'Select account',
  className,
  disabled,
}: AccountComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const selected = accounts.find((a) => a.id === value)

  const filtered = React.useMemo(() => {
    if (!query) return accounts
    const q = query.toLowerCase()
    return accounts.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.subType ?? '').toLowerCase().includes(q),
    )
  }, [accounts, query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                {selected.code}
              </span>
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code or name…"
            className="flex h-10 w-full bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No accounts found.
            </div>
          ) : (
            filtered.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  onChange(a.id)
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
              >
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded w-14 text-center shrink-0">
                  {a.code}
                </span>
                <span className="flex-1 truncate">{a.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {a.accountType}
                </span>
                <Check
                  className={cn(
                    'h-4 w-4 shrink-0 ml-1',
                    value === a.id ? 'opacity-100 text-accent' : 'opacity-0',
                  )}
                />
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
