'use client'

import * as React from 'react'
import {
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  Folder,
  FileText,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney, ACCOUNT_TYPE_META, type AccountType } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Switch } from '@/components/ui/switch'

interface AccountRow {
  id: string
  code: string
  name: string
  accountType: string
  subType: string | null
  parentId: string | null
  normalBalance: string
  active: boolean
  description?: string | null
}

export function ChartOfAccountsView() {
  const [accounts, setAccounts] = React.useState<AccountRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<'All' | AccountType>('All')
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  // Build tree by parent
  const childrenOf = React.useMemo(() => {
    const map: Record<string, AccountRow[]> = {}
    const roots: AccountRow[] = []
    for (const a of accounts) {
      if (!a.parentId) roots.push(a)
      else (map[a.parentId] ||= []).push(a)
    }
    return { map, roots }
  }, [accounts])

  // Filter — when searching, flatten + include matches with parents
  const filteredFlat = React.useMemo(() => {
    if (!search && typeFilter === 'All') return null
    const q = search.toLowerCase()
    return accounts.filter((a) => {
      const matchesSearch = !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
      const matchesType = typeFilter === 'All' || a.accountType === typeFilter
      return matchesSearch && matchesType
    })
  }, [accounts, search, typeFilter])

  const toggleExpand = (id: string) => {
    setExpanded((s) => ({ ...s, [id]: !s[id] }))
  }

  const toggleActive = async (acct: AccountRow) => {
    // Optimistic update
    setAccounts((prev) =>
      prev.map((a) => (a.id === acct.id ? { ...a, active: !a.active } : a)),
    )
    // Note: full PATCH endpoint omitted for brevity; this updates local state
  }

  const renderRow = (a: AccountRow, level: number, hasChildren: boolean) => {
    const isExpanded = expanded[a.id]
    const typeMeta = ACCOUNT_TYPE_META[a.accountType as AccountType]
    return (
      <React.Fragment key={a.id}>
        <div
          className={cn(
            'grid grid-cols-[2rem_5rem_1fr_8rem_8rem_4rem_3rem] items-center gap-2 border-b border-border/40 px-2 py-1.5 text-sm hover:bg-accent/5',
            level === 0 && 'bg-muted/30 font-medium',
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          <button
            onClick={() => hasChildren && toggleExpand(a.id)}
            className={cn(
              'flex h-5 w-5 items-center justify-center text-muted-foreground',
              !hasChildren && 'opacity-0 cursor-default',
            )}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <FileText className="h-3 w-3 opacity-40" />
            )}
          </button>
          <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">{a.name}</span>
            {a.subType && (
              <Badge variant="outline" className={cn('text-[10px] shrink-0', typeMeta?.bg, typeMeta?.color)}>
                {a.subType}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground capitalize">{a.accountType}</span>
          <span className="text-xs text-muted-foreground">{a.normalBalance}</span>
          <span className="text-xs">
            {a.active ? (
              <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Inactive
              </Badge>
            )}
          </span>
          <Switch
            checked={a.active}
            onCheckedChange={() => toggleActive(a)}
            aria-label="Toggle account active state"
          />
        </div>
        {hasChildren && isExpanded && childrenOf.map[a.id]?.map((child) => {
          const childHasChildren = (childrenOf.map[child.id]?.length ?? 0) > 0
          return renderRow(child, level + 1, childHasChildren)
        })}
      </React.Fragment>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Chart of Accounts</span>
            <span>·</span>
            <span>{accounts.length} accounts</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Hierarchical ledger accounts grouped by type. Toggle accounts active or inactive, drill into balances.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Account
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex gap-1 rounded-md border bg-card p-0.5">
          {(['All', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                typeFilter === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as AccountType[]).map((t) => {
          const count = accounts.filter((a) => a.accountType === t).length
          const meta = ACCOUNT_TYPE_META[t]
          return (
            <Card key={t} className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className={cn('text-xs font-medium uppercase tracking-wide', meta.color)}>{t}</div>
                  <div className="font-mono text-xl font-semibold">{count}</div>
                </div>
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-md', meta.bg, meta.color)}>
                  <Folder className="h-4 w-4" />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Tree table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account Hierarchy</CardTitle>
          <CardDescription>Click chevrons to expand/collapse. Toggle active state with the switch.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Header */}
          <div className="grid grid-cols-[2rem_5rem_1fr_8rem_8rem_4rem_3rem] items-center gap-2 border-b bg-muted/40 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <div></div>
            <div>Code</div>
            <div>Account Name</div>
            <div>Type</div>
            <div>Normal Balance</div>
            <div>Status</div>
            <div>Active</div>
          </div>
          {/* Rows */}
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : filteredFlat ? (
            filteredFlat.map((a) => {
              const typeMeta = ACCOUNT_TYPE_META[a.accountType as AccountType]
              return (
                <div
                  key={a.id}
                  className="grid grid-cols-[2rem_5rem_1fr_8rem_8rem_4rem_3rem] items-center gap-2 border-b border-border/40 px-2 py-1.5 text-sm hover:bg-accent/5"
                  style={{ paddingLeft: '8px' }}
                >
                  <div className="flex h-5 w-5 items-center justify-center text-muted-foreground opacity-0">
                    <FileText className="h-3 w-3" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{a.name}</span>
                    {a.subType && (
                      <Badge variant="outline" className={cn('text-[10px] shrink-0', typeMeta?.bg, typeMeta?.color)}>
                        {a.subType}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{a.accountType}</span>
                  <span className="text-xs text-muted-foreground">{a.normalBalance}</span>
                  <span className="text-xs">
                    {a.active ? (
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>
                    )}
                  </span>
                  <Switch
                    checked={a.active}
                    onCheckedChange={() => toggleActive(a)}
                    aria-label="Toggle account active state"
                  />
                </div>
              )
            })
          ) : (
            childrenOf.roots.map((a) => {
              const hasChildren = (childrenOf.map[a.id]?.length ?? 0) > 0
              return renderRow(a, 0, hasChildren)
            })
          )}
        </CardContent>
      </Card>
      <CreateFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title="Create New Account"
        description="Add an account to your chart of accounts."
        apiEndpoint="/api/accounts"
        successMessage="Account created successfully"
        onSuccess={() => setTimeout(() => load(), 100)}
        fields={[
          { key: 'code', label: 'Account Code', type: 'text', required: true, placeholder: '1000' },
          { key: 'name', label: 'Account Name', type: 'text', required: true, placeholder: 'Cash' },
          { key: 'accountType', label: 'Account Type', type: 'select', required: true, options: [
            { value: 'Asset', label: 'Asset' },
            { value: 'Liability', label: 'Liability' },
            { value: 'Equity', label: 'Equity' },
            { value: 'Revenue', label: 'Revenue' },
            { value: 'Expense', label: 'Expense' },
          ], defaultValue: 'Asset' },
          { key: 'subType', label: 'Sub Type', type: 'text', placeholder: 'Current Asset', helpText: 'e.g. Current Asset, Fixed Asset, Current Liability' },
          { key: 'normalBalance', label: 'Normal Balance', type: 'select', options: [
            { value: 'Debit', label: 'Debit' },
            { value: 'Credit', label: 'Credit' },
          ], defaultValue: 'Debit' },
          { key: 'description', label: 'Description', type: 'text', placeholder: 'Optional notes' },
        ]}
      />
    </div>
  )
}
