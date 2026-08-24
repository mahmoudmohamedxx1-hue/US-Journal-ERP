'use client'

import * as React from 'react'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  Users,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { useErpStore } from '@/lib/erp-store'
import { useAuth } from '@/app/page'
import { formatMoney, formatCompact, formatDate, STATUS_META, type JournalStatus } from '@/lib/format'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface DashboardData {
  organization: {
    id: string
    name: string
    legalName: string | null
    currency: string
  }
  kpis: {
    cashBalance: number
    ytdRevenue: number
    ytdExpenses: number
    netIncome: number
    accountsReceivable: number
    accountsPayable: number
    openAR: number
    openAP: number
    unpostedCount: number
    unpostedByStatus: Record<string, number>
    overdueInvoicesCount: number
    overdueBillsCount: number
  }
  monthlyPnl: Array<{ month: string; revenue: number; expenses: number }>
  recentJournals: Array<{
    id: string
    journalNumber: string
    journalDate: string
    description: string | null
    status: JournalStatus
    totalDebit: number
    createdBy: string
  }>
  bankAccounts: Array<{
    id: string
    name: string
    bankName: string | null
    accountNumber: string
    type: string
    balance: number
  }>
  fiscalPeriods: Array<{
    id: string
    name: string
    periodNumber: number
    status: string
    fiscalYear: string
  }>
}

export function DashboardView() {
  const { openJournal, setView } = useErpStore()
  const { user } = useAuth()
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Failed to load dashboard data: {error ?? 'Unknown error'}
      </div>
    )
  }

  const k = data.kpis

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">Dashboard</span>
          <span>·</span>
          <span>As of {formatDate(new Date())}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user.name.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s a snapshot of {data.organization.name}&apos;s financial position and recent activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Cash Balance" value={formatMoney(k.cashBalance)} hint={k.cashBalance > 0 ? 'across bank accounts' : 'no bank accounts yet'} icon={<Wallet className="h-4 w-4" />} variant="accent" />
        <KpiCard label="YTD Revenue" value={formatMoney(k.ytdRevenue)} hint={k.ytdRevenue > 0 ? 'posted activity' : 'no posted journals yet'} icon={<TrendingUp className="h-4 w-4" />} variant={k.ytdRevenue > 0 ? 'success' : 'default'} />
        <KpiCard label="YTD Expenses" value={formatMoney(k.ytdExpenses)} hint={k.ytdExpenses > 0 ? 'posted activity' : 'no posted journals yet'} icon={<TrendingDown className="h-4 w-4" />} />
        <KpiCard label="Net Income" value={formatMoney(k.netIncome)} hint={k.ytdRevenue === 0 && k.ytdExpenses === 0 ? 'no activity yet' : (k.netIncome >= 0 ? 'profit YTD' : 'loss YTD')} icon={<Receipt className="h-4 w-4" />} variant={k.netIncome >= 0 ? 'success' : 'danger'} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Accounts Receivable" value={formatMoney(k.accountsReceivable)} hint={`${k.overdueInvoicesCount} overdue invoices`} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Accounts Payable" value={formatMoney(k.accountsPayable)} hint={`${k.overdueBillsCount} overdue bills`} icon={<Receipt className="h-4 w-4" />} />
        <KpiCard label="Open AR" value={formatMoney(k.openAR)} hint="unpaid invoices" icon={<Clock className="h-4 w-4" />} />
        <KpiCard label="Unposted Journals" value={String(k.unpostedCount)} hint="awaiting approval" icon={<FileText className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Monthly Revenue vs Expenses</CardTitle>
            <CardDescription>Posted journal activity YTD</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setView('reports')}>
            View reports
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.monthlyPnl} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-5)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--chart-5)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => formatCompact(v)} />
              <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" stroke="var(--chart-3)" strokeWidth={2} fill="url(#revGrad)" name="Revenue" />
              <Area type="monotone" dataKey="expenses" stroke="var(--chart-5)" strokeWidth={2} fill="url(#expGrad)" name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Recent Journal Activity</CardTitle>
              <CardDescription>Latest entries across all statuses</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setView('journals')}>
              View all
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.recentJournals.map((j) => (
                <button key={j.id} onClick={() => openJournal(j.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/5 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-muted text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{j.journalNumber}</span>
                      <StatusBadge status={j.status} />
                    </div>
                    <div className="truncate text-sm font-medium">{j.description ?? '—'}</div>
                    <div className="text-[11px] text-muted-foreground">{formatDate(j.journalDate)} · by {j.createdBy}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-medium tabular-nums">{formatMoney(j.totalDebit)}</div>
                    <div className="text-[10px] text-muted-foreground">debit</div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cash Position</CardTitle>
              <CardDescription>Bank account balances</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data.bankAccounts.map((b) => ({ name: b.name, value: b.balance }))} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {data.bankAccounts.map((_, i) => (
                      <Cell key={i} fill={`var(--chart-${(i % 5) + 1})`} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {data.bankAccounts.slice(0, 4).map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{b.name}</span>
                      <span className="text-muted-foreground font-mono">{b.accountNumber}</span>
                    </div>
                    <span className="font-mono font-medium tabular-nums">{formatMoney(b.balance)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fiscal Period Status</CardTitle>
              <CardDescription>Current fiscal year</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5 max-h-[180px] overflow-y-auto">
              {data.fiscalPeriods.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{p.name}</span>
                  {p.status === 'Closed' ? (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Closed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 border-accent/40 text-accent">
                      <Clock className="h-2.5 w-2.5" />
                      Open
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Workflow Pipeline
          </CardTitle>
          <CardDescription>Journals awaiting action</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(['Draft', 'Submitted', 'Approved', 'Rejected'] as JournalStatus[]).map((s) => {
              const count = k.unpostedByStatus[s] ?? 0
              const meta = STATUS_META[s]
              return (
                <button key={s} onClick={() => setView('journals')} className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent/5 transition-colors">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-md ${meta.bg} ${meta.color}`}>
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-mono text-xl font-semibold">{count}</div>
                    <div className="text-[11px] text-muted-foreground">{meta.label}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
