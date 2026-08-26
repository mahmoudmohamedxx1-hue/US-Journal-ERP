'use client'

import * as React from 'react'
import {
  Search,
  Plus,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckCircle2,
  Send,
  Ban,
  RotateCcw,
  ArrowUpCircle,
  MoreHorizontal,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useErpStore } from '@/lib/erp-store'
import { formatMoney, formatDate, JOURNAL_STATUSES, type JournalStatus } from '@/lib/format'
import { StatusBadge } from '@/components/erp/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface JournalListItem {
  id: string
  journalNumber: string
  journalDate: string
  postingDate: string | null
  source: string | null
  reference: string | null
  description: string | null
  status: JournalStatus
  totalDebit: number
  totalCredit: number
  createdBy: { name: string }
  approvedBy: { name: string } | null
  postedBy: { name: string } | null
}

export function JournalRegisterView() {
  const { openJournal, setView, pendingSearch, setPendingSearch } = useErpStore()
  const [journals, setJournals] = React.useState<JournalListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'All' | JournalStatus>('All')
  const [sourceFilter, setSourceFilter] = React.useState<'All' | string>('All')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const [actionLoading, setActionLoading] = React.useState<Record<string, boolean>>({})

  const pageSize = 20

  // Consume pending search from global store (set by AppShell search bar)
  React.useEffect(() => {
    if (pendingSearch) {
      setSearch(pendingSearch)
      setPendingSearch('')
      setPage(1)
    }
  }, [pendingSearch, setPendingSearch])

  const load = React.useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    if (search) params.set('q', search)
    if (statusFilter !== 'All') params.set('status', statusFilter)
    if (sourceFilter !== 'All') params.set('source', sourceFilter)

    fetch(`/api/journals?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setJournals(d.journals || [])
        setTotal(d.total || 0)
        setTotalPages(d.totalPages || 1)
        setSelected({})
      })
      .finally(() => setLoading(false))
  }, [page, search, statusFilter, sourceFilter])

  React.useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1)
  }, [search, statusFilter, sourceFilter])

  const sources = ['All', 'Manual', 'AP', 'AR', 'Reversal']

  const runAction = async (
    journalId: string,
    action: 'submit' | 'approve' | 'reject' | 'post' | 'reverse',
  ) => {
    setActionLoading((s) => ({ ...s, [`${journalId}-${action}`]: true }))
    try {
      const body = action === 'reject' ? { reason: 'Returned from register' } : undefined
      const res = await fetch(`/api/journals/${journalId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || `Failed to ${action}`)
      toast.success(`Journal ${action}ed successfully`)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to ${action}`)
    } finally {
      setActionLoading((s) => ({ ...s, [`${journalId}-${action}`]: false }))
    }
  }

  const bulkAction = async (action: 'submit' | 'approve' | 'post') => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
    if (ids.length === 0) return
    setActionLoading((s) => ({ ...s, [`bulk-${action}`]: true }))
    let okCount = 0
    let failCount = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/journals/${id}/${action}`, { method: 'POST' })
        if (res.ok) okCount++
        else failCount++
      } catch {
        failCount++
      }
    }
    setActionLoading((s) => ({ ...s, [`bulk-${action}`]: false }))
    if (okCount > 0) toast.success(`${okCount} journal${okCount > 1 ? 's' : ''} ${action}ed`)
    if (failCount > 0) toast.error(`${failCount} failed`)
    load()
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Journal Register</span>
            <span>·</span>
            <span>{total} entries</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Journal Entries</h1>
          <p className="text-sm text-muted-foreground">
            Browse, filter, and act on journals through the approval workflow.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            import('@/lib/export-utils').then(async ({ exportToExcel, exportToPdf }) => {
              try {
                exportToExcel(`journals-${Date.now()}`, journals as unknown as Array<Record<string, unknown>>, [
                  { key: 'journalNumber', label: 'Journal Number' },
                  { key: 'description', label: 'Description' },
                  { key: 'journalDate', label: 'Date' },
                  { key: 'status', label: 'Status' },
                  { key: 'totalDebit', label: 'Debit (cents)' },
                  { key: 'reference', label: 'Reference' },
                  { key: 'source', label: 'Source' },
                ])
                await exportToPdf(`journals-${Date.now()}`, 'Journal Register', journals as unknown as Array<Record<string, unknown>>, [
                  { key: 'journalNumber', label: 'Number' },
                  { key: 'description', label: 'Description' },
                  { key: 'journalDate', label: 'Date' },
                  { key: 'status', label: 'Status' },
                  { key: 'totalDebit', label: 'Amount' },
                ], 'All journal entries')
              } catch (e) {
                console.error('Export failed:', e)
              }
            })
          }}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export Excel + PDF
          </Button>
          <Button size="sm" onClick={() => setView('journal-new')}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Journal
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by number, description, or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex gap-1 rounded-md border bg-card p-0.5 overflow-x-auto">
          {(['All', ...JOURNAL_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-md border bg-card p-0.5">
          {sources.map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                sourceFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/5 px-3 py-2">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkAction('submit')} disabled={!!actionLoading['bulk-submit']}>
              {actionLoading['bulk-submit'] ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              Submit
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkAction('approve')} disabled={!!actionLoading['bulk-approve']}>
              {actionLoading['bulk-approve'] ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkAction('post')} disabled={!!actionLoading['bulk-post']}>
              {actionLoading['bulk-post'] ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />}
              Post
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="grid grid-cols-[2rem_8rem_1fr_8rem_7rem_9rem_8rem_3rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <div>
              <Checkbox
                checked={journals.length > 0 && journals.every((j) => selected[j.id])}
                onCheckedChange={(v) => {
                  const next: Record<string, boolean> = {}
                  if (v) journals.forEach((j) => (next[j.id] = true))
                  setSelected(next)
                }}
              />
            </div>
            <div>Number</div>
            <div>Description</div>
            <div>Date</div>
            <div>Status</div>
            <div className="text-right">Amount</div>
            <div>Source</div>
            <div></div>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : journals.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <div className="mt-2 text-sm font-medium">No journals found</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Try adjusting filters or create a new journal entry.
              </div>
            </div>
          ) : (
            journals.map((j) => {
              const isLoading = !!actionLoading[`${j.id}-post`] || !!actionLoading[`${j.id}-submit`] || !!actionLoading[`${j.id}-approve`] || !!actionLoading[`${j.id}-reverse`]
              return (
                <div
                  key={j.id}
                  className="grid grid-cols-[2rem_8rem_1fr_8rem_7rem_9rem_8rem_3rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm hover:bg-accent/5 cursor-pointer"
                  onClick={() => openJournal(j.id)}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={!!selected[j.id]}
                      onCheckedChange={(v) => setSelected((s) => ({ ...s, [j.id]: !!v }))}
                    />
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">{j.journalNumber}</div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{j.description ?? '—'}</div>
                    {j.reference && (
                      <div className="text-[10px] text-muted-foreground">Ref: {j.reference}</div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDate(j.journalDate)}</div>
                  <div>
                    <StatusBadge status={j.status} />
                  </div>
                  <div className="text-right font-mono text-xs font-medium tabular-nums">
                    {formatMoney(j.totalDebit)}
                  </div>
                  <div>
                    {j.source && (
                      <Badge variant="outline" className="text-[10px]">
                        {j.source}
                      </Badge>
                    )}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isLoading}>
                          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openJournal(j.id)}>
                          <FileText className="mr-2 h-3.5 w-3.5" />
                          View details
                        </DropdownMenuItem>
                        {j.status === 'Draft' && (
                          <DropdownMenuItem onClick={() => runAction(j.id, 'submit')}>
                            <Send className="mr-2 h-3.5 w-3.5" />
                            Submit for approval
                          </DropdownMenuItem>
                        )}
                        {(j.status === 'Submitted' || j.status === 'Under Review') && (
                          <>
                            <DropdownMenuItem onClick={() => runAction(j.id, 'approve')}>
                              <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => runAction(j.id, 'reject')}>
                              <Ban className="mr-2 h-3.5 w-3.5" />
                              Reject
                            </DropdownMenuItem>
                          </>
                        )}
                        {j.status === 'Approved' && (
                          <DropdownMenuItem onClick={() => runAction(j.id, 'post')}>
                            <ArrowUpCircle className="mr-2 h-3.5 w-3.5" />
                            Post to GL
                          </DropdownMenuItem>
                        )}
                        {j.status === 'Posted' && (
                          <DropdownMenuItem onClick={() => runAction(j.id, 'reverse')}>
                            <RotateCcw className="mr-2 h-3.5 w-3.5" />
                            Reverse journal
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })
          )}

          {/* Pagination */}
          {!loading && journals.length > 0 && (
            <div className="flex items-center justify-between border-t px-3 py-2">
              <div className="text-xs text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
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
