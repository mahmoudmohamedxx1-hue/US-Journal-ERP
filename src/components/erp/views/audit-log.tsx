'use client'

import * as React from 'react'
import {
  ScrollText,
  Plus,
  Send,
  CheckCircle2,
  Ban,
  ArrowUpCircle,
  RotateCcw,
  UserPlus,
  Lock,
  Unlock,
  Building2,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const ACTION_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  CREATE_JOURNAL:   { icon: Plus,         color: 'text-blue-700',    bg: 'bg-blue-50' },
  UPDATE_JOURNAL:   { icon: FileText,     color: 'text-blue-700',    bg: 'bg-blue-50' },
  DELETE_JOURNAL:   { icon: Ban,          color: 'text-red-700',     bg: 'bg-red-50' },
  SUBMIT_JOURNAL:   { icon: Send,         color: 'text-blue-700',    bg: 'bg-blue-50' },
  APPROVE_JOURNAL:  { icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  REJECT_JOURNAL:   { icon: Ban,          color: 'text-amber-700',   bg: 'bg-amber-50' },
  POST_JOURNAL:     { icon: ArrowUpCircle, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  REVERSE_JOURNAL:  { icon: RotateCcw,     color: 'text-purple-700',  bg: 'bg-purple-50' },
  CREATE_ORG:       { icon: Building2,    color: 'text-slate-700',   bg: 'bg-slate-50' },
  INVITE_USER:      { icon: UserPlus,    color: 'text-blue-700',    bg: 'bg-blue-50' },
  CLOSE_PERIOD:     { icon: Lock,         color: 'text-amber-700',   bg: 'bg-amber-50' },
  REOPEN_PERIOD:    { icon: Unlock,       color: 'text-emerald-700', bg: 'bg-emerald-50' },
}

export function AuditLogView() {
  const [logs, setLogs] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)

  const load = React.useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: '25' })
    fetch(`/api/audit-log?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs || [])
        setTotal(d.total || 0)
        setTotalPages(d.totalPages || 1)
      })
      .finally(() => setLoading(false))
  }, [page])

  React.useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  const filtered = logs.filter((l) =>
    !search ||
    l.description.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    (l.user?.name ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">Audit Log</span>
          <span>·</span>
          <span>{total} entries</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Every material action is recorded. Read-only — auditors have full visibility.
        </p>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search by action, description, or user…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((l) => {
                const meta = ACTION_META[l.action] || { icon: ScrollText, color: 'text-slate-700', bg: 'bg-slate-50' }
                const Icon = meta.icon
                return (
                  <div key={l.id} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/5">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-md shrink-0', meta.bg, meta.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{l.description}</span>
                        <Badge variant="outline" className={cn('text-[10px]', meta.bg, meta.color)}>{l.action}</Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        by <span className="font-medium">{l.user?.name ?? 'System'}</span> ({l.user?.role ?? '—'})
                        <span className="mx-1">·</span>
                        {formatDateTime(l.createdAt)}
                        {l.entityType && (
                          <>
                            <span className="mx-1">·</span>
                            <span className="font-mono">{l.entityType}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {!loading && logs.length > 0 && (
            <div className="flex items-center justify-between border-t px-3 py-2">
              <div className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total} total
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="outline" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="outline" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
