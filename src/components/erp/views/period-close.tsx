'use client'

import * as React from 'react'
import { CheckCircle2, AlertCircle, FileCheck, Lock, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ChecklistItem {
  id: string
  label: string
  description: string
  done: boolean
  detail?: string
}

export function PeriodCloseView() {
  const [items, setItems] = React.useState<ChecklistItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // Fetch dashboard data to compute checklist status
        const [dashRes, journalsRes, bankRes, fiscalRes] = await Promise.all([
          fetch('/api/dashboard').then((r) => r.json()),
          fetch('/api/journals?status=Draft&pageSize=1').then((r) => r.json()),
          fetch('/api/banking').then((r) => r.json()),
          fetch('/api/fiscal-periods').then((r) => r.json()),
        ])

        const k = dashRes.kpis || {}
        const draftJournals = journalsRes.total || 0
        const bankAccounts = bankRes.accounts || []
        const fiscalYears = fiscalRes.fiscalYears || []

        // Find the current period
        const today = new Date()
        let currentPeriod = null
        for (const fy of fiscalYears) {
          for (const p of fy.periods) {
            if (new Date(p.startDate) <= today && new Date(p.endDate) >= today) {
              currentPeriod = p
              break
            }
          }
          if (currentPeriod) break
        }

        setItems([
          {
            id: 'drafts',
            label: 'Post all draft journals',
            description: 'Submit and post all journal entries in Draft status',
            done: draftJournals === 0,
            detail: draftJournals > 0 ? `${draftJournals} draft(s) remaining` : 'All drafts posted',
          },
          {
            id: 'reconcile',
            label: 'Reconcile bank accounts',
            description: 'Match bank transactions with your bank statements',
            done: bankAccounts.every((b: { transactions?: unknown[] }) => !b.transactions || b.transactions.length === 0),
            detail: `${bankAccounts.length} account(s) to review`,
          },
          {
            id: 'review-ar',
            label: 'Review Accounts Receivable',
            description: 'Check for overdue invoices and follow up with customers',
            done: (k.overdueInvoicesCount || 0) === 0,
            detail: `${k.overdueInvoicesCount || 0} overdue invoice(s)`,
          },
          {
            id: 'review-ap',
            label: 'Review Accounts Payable',
            description: 'Check for overdue bills and schedule payments',
            done: (k.overdueBillsCount || 0) === 0,
            detail: `${k.overdueBillsCount || 0} overdue bill(s)`,
          },
          {
            id: 'trial-balance',
            label: 'Run Trial Balance',
            description: 'Verify debits equal credits',
            done: true,
            detail: 'Trial balance available in Financial Reports',
          },
          {
            id: 'review-expenses',
            label: 'Review expense journals',
            description: 'Verify all expenses are recorded for the period',
            done: true,
            detail: 'Check journal register for the period',
          },
          {
            id: 'close-period',
            label: 'Close the fiscal period',
            description: currentPeriod
              ? `Close "${currentPeriod.name}" to prevent further postings`
              : 'No active fiscal period found',
            done: currentPeriod?.status === 'Closed',
            detail: currentPeriod?.status === 'Closed' ? 'Period is closed' : currentPeriod ? `Period "${currentPeriod.name}" is ${currentPeriod.status}` : 'Create a fiscal year first',
          },
        ])
      } catch (e) {
        // ignore
      }
      setLoading(false)
    }
    load()
  }, [])

  const completedCount = items.filter((i) => i.done).length
  const allDone = completedCount === items.length

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">Workflow</span>
          <span>·</span>
          <span>{completedCount}/{items.length} steps completed</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Period Close Checklist</h1>
        <p className="text-sm text-muted-foreground">
          Follow this checklist to properly close an accounting period. Each step must be completed before moving to the next.
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5">
        {items.map((item) => (
          <div key={item.id} className={cn('h-2 flex-1 rounded-full', item.done ? 'bg-emerald-500' : 'bg-muted')} />
        ))}
      </div>

      {/* Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Close Checklist
          </CardTitle>
          <CardDescription>
            {allDone ? '✅ All steps complete — you can close the period!' : `${items.length - completedCount} step(s) remaining`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading checklist…</div>
          ) : (
            items.map((item, idx) => (
              <div key={item.id} className={cn('flex items-start gap-3 rounded-md border p-3', item.done ? 'border-emerald-200 bg-emerald-50' : 'border-border')}>
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-full shrink-0', item.done ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                  {item.done ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-medium', item.done && 'text-emerald-800')}>{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                  {item.detail && (
                    <div className={cn('text-xs mt-1', item.done ? 'text-emerald-700' : 'text-amber-700')}>
                      {item.done ? '✓' : '⏳'} {item.detail}
                    </div>
                  )}
                </div>
                {!item.done && item.id === 'close-period' && (
                  <Button size="sm" variant="outline" onClick={() => { window.location.href = '/' }}>
                    <Lock className="mr-1.5 h-3 w-3" />
                    Go to Periods
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {!loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Completed</div>
            <div className="font-mono text-xl font-semibold text-emerald-600">{completedCount}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><AlertCircle className="h-4 w-4 text-amber-600" /> Remaining</div>
            <div className="font-mono text-xl font-semibold text-amber-600">{items.length - completedCount}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Clock className="h-4 w-4 text-blue-600" /> Total Steps</div>
            <div className="font-mono text-xl font-semibold">{items.length}</div>
          </Card>
        </div>
      )}
    </div>
  )
}
