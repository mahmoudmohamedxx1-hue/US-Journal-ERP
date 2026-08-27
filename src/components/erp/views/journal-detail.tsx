'use client'

import * as React from 'react'
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  Ban,
  ArrowUpCircle,
  RotateCcw,
  Printer,
  Download,
  Loader2,
  FileText,
  Calendar,
  User,
  Hash,
  Tag,
} from 'lucide-react'
import { useErpStore } from '@/lib/erp-store'
import { formatMoney, formatDate, formatDateTime, type JournalStatus } from '@/lib/format'
import { StatusBadge } from '@/components/erp/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/erp/confirm-dialog'
import { CreditNoteButton } from '@/components/erp/admin-widgets'

interface JournalDetail {
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
  currency: string
  exchangeRate: number
  rejectionReason: string | null
  createdAt: string
  fiscalPeriod: { name: string; status: string } | null
  createdBy: { name: string; email: string; role: string }
  submittedBy: { name: string; email: string } | null
  submittedAt: string | null
  approvedBy: { name: string; email: string } | null
  approvedAt: string | null
  postedBy: { name: string; email: string } | null
  postedAt: string | null
  lines: Array<{
    id: string
    lineNumber: number
    description: string | null
    debit: number
    credit: number
    account: { id: string; code: string; name: string; accountType: string }
  }>
  approvals: Array<{
    id: string
    action: string
    comment: string | null
    at: string
    byUser: { name: string; email: string; role: string }
  }>
  reversalOf: { journalNumber: string } | null
}

export function JournalDetailView() {
  const { selectedJournalId, setView, openJournal } = useErpStore()
  const [journal, setJournal] = React.useState<JournalDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [reverseOpen, setReverseOpen] = React.useState(false)

  const load = React.useCallback(() => {
    if (!selectedJournalId) return
    setLoading(true)
    fetch(`/api/journals/${selectedJournalId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.journal) setJournal(d.journal)
      })
      .finally(() => setLoading(false))
  }, [selectedJournalId])

  React.useEffect(() => {
    load()
  }, [load])

  const runAction = async (
    action: 'submit' | 'approve' | 'reject' | 'post' | 'reverse',
    extra?: Record<string, unknown>,
  ) => {
    if (!journal) return
    setActionLoading(action)
    try {
      const res = await fetch(`/api/journals/${journal.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: extra ? JSON.stringify(extra) : undefined,
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || `Failed to ${action}`)
      // Use proper past-tense form per action
      const pastTense: Record<string, string> = {
        submit: 'submitted',
        approve: 'approved',
        reject: 'rejected',
        post: 'posted',
        reverse: 'reversed',
      }
      toast.success(`Journal ${pastTense[action] || action + 'ed'} successfully`)
      if (action === 'reverse' && d.reversalId) {
        openJournal(d.reversalId)
      } else {
        load()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to ${action}`)
    } finally {
      setActionLoading(null)
      setRejectOpen(false)
      setReverseOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!journal) {
    return (
      <div className="rounded-lg border p-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <div className="mt-2 text-sm font-medium">Journal not found</div>
        <Button className="mt-3" variant="outline" onClick={() => setView('journals')}>
          Back to register
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => setView('journals')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{journal.journalNumber}</span>
            <span>·</span>
            <span>{formatDate(journal.journalDate)}</span>
            {journal.fiscalPeriod && (
              <>
                <span>·</span>
                <span>{journal.fiscalPeriod.name}</span>
              </>
            )}
          </div>
          <h1 className="text-xl font-semibold tracking-tight truncate">
            {journal.description || `Journal ${journal.journalNumber}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={journal.status} size="md" />
          <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
          </Button>
        </div>
      </div>

      {/* Reversal banner */}
      {journal.reversalOf && (
        <div className="rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-700">
          <RotateCcw className="mr-2 inline h-3.5 w-3.5" />
          This is a reversal of journal <span className="font-mono">{journal.reversalOf.journalNumber}</span>
        </div>
      )}

      {journal.rejectionReason && journal.status === 'Rejected' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <Ban className="mr-2 inline h-3.5 w-3.5" />
          Rejection reason: {journal.rejectionReason}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lines table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Journal Lines</CardTitle>
            <CardDescription>
              {journal.lines.length} line{journal.lines.length !== 1 ? 's' : ''} · {journal.currency} · rate {journal.exchangeRate}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-[3rem_5rem_1fr_8rem_8rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <div>#</div>
              <div>Code</div>
              <div>Account</div>
              <div className="text-right">Debit</div>
              <div className="text-right">Credit</div>
            </div>
            {journal.lines.map((l) => (
              <div key={l.id} className="grid grid-cols-[3rem_5rem_1fr_8rem_8rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm">
                <div className="font-mono text-xs text-muted-foreground">{l.lineNumber}</div>
                <div className="font-mono text-xs">{l.account.code}</div>
                <div>
                  <div className="font-medium">{l.account.name}</div>
                  {l.description && (
                    <div className="text-[11px] text-muted-foreground">{l.description}</div>
                  )}
                  <Badge variant="outline" className="text-[10px] mt-0.5">{l.account.accountType}</Badge>
                </div>
                <div className="text-right font-mono text-xs tabular-nums">
                  {l.debit > 0 ? formatMoney(l.debit) : '—'}
                </div>
                <div className="text-right font-mono text-xs tabular-nums">
                  {l.credit > 0 ? formatMoney(l.credit) : '—'}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-[3rem_5rem_1fr_8rem_8rem] items-center gap-2 border-t-2 bg-muted/30 px-3 py-2 text-sm font-medium">
              <div></div>
              <div></div>
              <div className="text-xs uppercase text-muted-foreground">Totals</div>
              <div className="text-right font-mono tabular-nums">{formatMoney(journal.totalDebit)}</div>
              <div className="text-right font-mono tabular-nums">{formatMoney(journal.totalCredit)}</div>
            </div>
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Difference:{' '}
              <span className={Math.abs(journal.totalDebit - journal.totalCredit) < 0.005 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                {formatMoney(journal.totalDebit - journal.totalCredit)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar: header info + approvals + actions */}
        <div className="space-y-4">
          {/* Header info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Header Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Journal Date" value={formatDate(journal.journalDate)} />
              <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Posting Date" value={formatDate(journal.postingDate)} />
              <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={journal.source ?? '—'} />
              <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label="Reference" value={journal.reference ?? '—'} />
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Created By" value={journal.createdBy.name} />
              <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Created At" value={formatDateTime(journal.createdAt)} />
              {journal.fiscalPeriod && (
                <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label="Fiscal Period" value={journal.fiscalPeriod.name} />
              )}
            </CardContent>
          </Card>

          {/* Approval timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {journal.approvals.length === 0 ? (
                <div className="text-xs text-muted-foreground">No activity yet.</div>
              ) : (
                journal.approvals.map((a) => (
                  <div key={a.id} className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                      {a.action === 'Submitted' && <Send className="h-3.5 w-3.5" />}
                      {a.action === 'Approved' && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {a.action === 'Rejected' && <Ban className="h-3.5 w-3.5" />}
                      {a.action === 'Posted' && <ArrowUpCircle className="h-3.5 w-3.5" />}
                      {a.action === 'Reversed' && <RotateCcw className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{a.action}</div>
                      <div className="text-xs text-muted-foreground">
                        by {a.byUser.name} · {formatDateTime(a.at)}
                      </div>
                      {a.comment && (
                        <div className="mt-1 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                          {a.comment}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="no-print">
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
              <CardDescription>Available based on current status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {journal.status === 'Draft' && (
                <>
                  <Button
                    className="w-full"
                    onClick={() => runAction('submit')}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === 'submit' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                    Submit for Approval
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => { const store = useErpStore.getState(); store.setPendingSearch(''); store.setView('journal-new'); }}
                    disabled={actionLoading !== null}
                  >
                    Edit Draft
                  </Button>
                </>
              )}
              {(journal.status === 'Submitted' || journal.status === 'Under Review') && (
                <>
                  <Button
                    className="w-full"
                    onClick={() => runAction('approve')}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === 'approve' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                    Approve
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setRejectOpen(true)}
                    disabled={actionLoading !== null}
                  >
                    <Ban className="mr-1.5 h-4 w-4" />
                    Reject
                  </Button>
                </>
              )}
              {journal.status === 'Approved' && (
                <Button
                  className="w-full"
                  onClick={() => runAction('post')}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'post' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ArrowUpCircle className="mr-1.5 h-4 w-4" />}
                  Post to General Ledger
                </Button>
              )}
              {journal.status === 'Posted' && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setReverseOpen(true)}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'reverse' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
                  Reverse Journal
                </Button>
              )}
              {journal.status === 'Posted' && (
                <CreditNoteButton journalId={journal.id} onCreated={() => load()} />
              )}
              <Separator className="my-2" />
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => setView('journals')}
                disabled={actionLoading !== null}
              >
                Back to Register
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this journal?"
        description="The journal will be marked as Rejected and returned to the creator for revision."
        confirmLabel="Reject journal"
        destructive
        onConfirm={() => runAction('reject', { reason: 'Returned by approver' })}
      />
      <ConfirmDialog
        open={reverseOpen}
        onOpenChange={setReverseOpen}
        title="Reverse this posted journal?"
        description="A new Posted journal will be created that mirrors every line (debit ↔ credit). The original will be marked as Reversed."
        confirmLabel="Create reversal"
        onConfirm={() => runAction('reverse')}
      />
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground w-24">{label}</span>
      <span className="text-sm font-medium ml-auto text-right">{value}</span>
    </div>
  )
}
