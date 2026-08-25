'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useErpStore } from '@/lib/erp-store'

interface OrgInfo {
  id: string
  name: string
  legalName: string | null
  taxId: string | null
  currency: string
}

/**
 * Org switcher — fetches the current user's organization from /api/organization
 * and displays it in the topbar. In a real ERP, there's no hardcoded org name.
 */
export function OrgSwitcher() {
  const setView = useErpStore((s) => s.setView)
  const [org, setOrg] = React.useState<OrgInfo | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    fetch('/api/organization')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        if (d?.organization) setOrg(d.organization)
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const displayName = org?.name ?? (loading ? 'Loading…' : 'Organization')
  const initials = (org?.name ?? 'UJ')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 -ml-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-[10px] font-bold">
            {initials}
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-sm font-medium truncate max-w-[180px]">{displayName}</span>
            <span className="text-[10px] text-muted-foreground">{org?.currency ?? 'USD'}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {org && (
          <DropdownMenuItem className="flex flex-col items-start gap-0.5">
            <span className="text-sm font-medium">{org.name}</span>
            {org.legalName && (
              <span className="text-[10px] text-muted-foreground">{org.legalName}</span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {org.taxId ? `${org.taxId} • ` : ''}{org.currency}
            </span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setView('settings-org')}>
          Organization settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
