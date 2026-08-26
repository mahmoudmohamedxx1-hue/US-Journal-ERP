'use client'

import * as React from 'react'
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useErpStore } from '@/lib/erp-store'
import { formatMoney, formatDate } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

type ReportKey = 'trial-balance' | 'balance-sheet' | 'income-statement' | 'cash-flow'

const REPORTS: Array<{ key: ReportKey; label: string; description: string }> = [
  { key: 'trial-balance', label: 'Trial Balance', description: 'All accounts with debit/credit balances as of a date' },
  { key: 'balance-sheet', label: 'Balance Sheet', description: 'Assets = Liabilities + Equity as of a date' },
  { key: 'income-statement', label: 'Income Statement', description: 'Revenue − Expenses for a date range' },
  { key: 'cash-flow', label: 'Cash Flow Statement', description: 'Indirect method — Operating / Investing / Financing' },
]

export function ReportsView() {
  const { selectedReport, setReport } = useErpStore()
  const [from, setFrom] = React.useState('2026-01-01')
  const [to, setTo] = React.useState('2026-12-31')
  const [asOf, setAsOf] = React.useState('2026-12-31')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Financial Reports</span>
            <span>·</span>
            <span>Generated from posted journals</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Financial Reports</h1>
          <p className="text-sm text-muted-foreground">
            Standard financial statements with server-side aggregation and audit-traceable totals.
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Report tabs */}
      <div className="flex gap-1 rounded-md border bg-card p-0.5 overflow-x-auto no-print">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setReport(r.key)}
            className={cn(
              'rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
              selectedReport === r.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title={r.description}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Date selectors */}
      <Card className="no-print">
        <CardContent className="flex items-end gap-3 flex-wrap py-4">
          {(selectedReport === 'income-statement' || selectedReport === 'cash-flow') ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">From</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-40" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">To</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-40" />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">As of</label>
              <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="h-8 w-40" />
            </div>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            Data refreshed on demand
          </div>
        </CardContent>
      </Card>

      {/* Report body */}
      {selectedReport === 'trial-balance' && <TrialBalanceReport asOf={asOf} />}
      {selectedReport === 'balance-sheet' && <BalanceSheetReport asOf={asOf} />}
      {selectedReport === 'income-statement' && <IncomeStatementReport from={from} to={to} />}
      {selectedReport === 'cash-flow' && <CashFlowReport from={from} to={to} />}
    </div>
  )
}

// ============== Trial Balance ==============
function TrialBalanceReport({ asOf }: { asOf: string }) {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/trial-balance?asOf=${asOf}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [asOf])

  if (loading) return <Skeleton className="h-96 w-full" />
  if (!data) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trial Balance</CardTitle>
        <CardDescription>As of {formatDate(data.asOf)} · {data.rows.length} accounts</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[5rem_1fr_8rem_8rem_8rem_8rem_8rem_8rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <div>Code</div>
          <div>Account</div>
          <div className="text-right">Opening Dr</div>
          <div className="text-right">Opening Cr</div>
          <div className="text-right">Movement Dr</div>
          <div className="text-right">Movement Cr</div>
          <div className="text-right">Ending Dr</div>
          <div className="text-right">Ending Cr</div>
        </div>
        <div className="max-h-[640px] overflow-y-auto">
          {data.rows.map((r: any) => (
            <div key={r.code} className="grid grid-cols-[5rem_1fr_8rem_8rem_8rem_8rem_8rem_8rem] items-center gap-2 border-b border-border/40 px-3 py-1.5 text-sm">
              <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
              <div className="truncate">{r.name}</div>
              <div className="text-right font-mono text-xs tabular-nums">{r.openingDebit ? formatMoney(r.openingDebit) : '—'}</div>
              <div className="text-right font-mono text-xs tabular-nums">{r.openingCredit ? formatMoney(r.openingCredit) : '—'}</div>
              <div className="text-right font-mono text-xs tabular-nums">{r.movementDebit ? formatMoney(r.movementDebit) : '—'}</div>
              <div className="text-right font-mono text-xs tabular-nums">{r.movementCredit ? formatMoney(r.movementCredit) : '—'}</div>
              <div className="text-right font-mono text-xs tabular-nums font-medium">{r.endingDebit ? formatMoney(r.endingDebit) : '—'}</div>
              <div className="text-right font-mono text-xs tabular-nums font-medium">{r.endingCredit ? formatMoney(r.endingCredit) : '—'}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[5rem_1fr_8rem_8rem_8rem_8rem_8rem_8rem] items-center gap-2 border-t-2 bg-muted/30 px-3 py-2 text-sm font-semibold">
          <div></div>
          <div>TOTALS</div>
          <div className="text-right font-mono text-xs tabular-nums">{formatMoney(0)}</div>
          <div className="text-right font-mono text-xs tabular-nums">{formatMoney(0)}</div>
          <div className="text-right font-mono text-xs tabular-nums">{formatMoney(0)}</div>
          <div className="text-right font-mono text-xs tabular-nums">{formatMoney(0)}</div>
          <div className="text-right font-mono text-xs tabular-nums">{formatMoney(data.totals.debit)}</div>
          <div className="text-right font-mono text-xs tabular-nums">{formatMoney(data.totals.credit)}</div>
        </div>
        <div className="px-3 py-2 flex items-center justify-between border-t text-xs">
          <div>
            Difference:{' '}
            <span className={data.isBalanced ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
              {formatMoney(data.totals.debit - data.totals.credit)}
            </span>
          </div>
          {data.isBalanced ? (
            <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">Balanced</Badge>
          ) : (
            <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">Out of balance</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============== Balance Sheet ==============
function BalanceSheetReport({ asOf }: { asOf: string }) {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/balance-sheet?asOf=${asOf}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [asOf])

  if (loading) return <Skeleton className="h-96 w-full" />
  if (!data) return null
  const s = data.sections

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance Sheet</CardTitle>
        <CardDescription>As of {formatDate(data.asOf)} · all figures in EGP</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Assets */}
          <div className="space-y-4">
            <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Assets</div>
            <ReportSection title="Current Assets" items={s.currentAssets.items} total={s.currentAssets.total} />
            <ReportSection title="Fixed Assets" items={s.fixedAssets.items} total={s.fixedAssets.total} />
            <ReportSection title="Other Assets" items={s.otherAssets.items} total={s.otherAssets.total} />
            <div className="flex justify-between border-t-2 pt-2 text-base font-bold">
              <span>Total Assets</span>
              <span className="font-mono tabular-nums">{formatMoney(s.totalAssets)}</span>
            </div>
          </div>

          {/* Liabilities + Equity */}
          <div className="space-y-4">
            <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Liabilities & Equity</div>
            <ReportSection title="Current Liabilities" items={s.currentLiabilities.items} total={s.currentLiabilities.total} />
            <ReportSection title="Long-term Liabilities" items={s.longTermLiabilities.items} total={s.longTermLiabilities.total} />
            <div className="flex justify-between border-t pt-1 text-sm font-semibold">
              <span>Total Liabilities</span>
              <span className="font-mono tabular-nums">{formatMoney(s.totalLiabilities)}</span>
            </div>
            <ReportSection title="Equity" items={s.equity.items} total={s.equity.total} />
            <div className="flex justify-between border-t pt-1 text-sm">
              <span>Net Income (YTD)</span>
              <span className="font-mono tabular-nums">{formatMoney(s.netIncome)}</span>
            </div>
            <div className="flex justify-between border-t-2 pt-2 text-base font-bold">
              <span>Total Equity</span>
              <span className="font-mono tabular-nums">{formatMoney(s.totalEquity)}</span>
            </div>
            <div className="flex justify-between border-t-2 bg-muted/30 px-2 py-2 text-base font-bold rounded">
              <span>Total Liabilities & Equity</span>
              <span className="font-mono tabular-nums">{formatMoney(s.totalLiabilitiesAndEquity)}</span>
            </div>
            <div className="flex justify-end">
              {s.isBalanced ? (
                <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">Balanced</Badge>
              ) : (
                <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">Out of balance</Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ReportSection({ title, items, total }: { title: string; items: Array<{ code: string; name: string; amount: number }>; total: number }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="space-y-0.5 pl-2">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground py-1">No activity</div>
        ) : (
          items.map((it) => (
            <div key={it.code} className="flex justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">{it.code}</span>
                <span className="truncate">{it.name}</span>
              </div>
              <span className="font-mono tabular-nums">{formatMoney(it.amount)}</span>
            </div>
          ))
        )}
      </div>
      <div className="flex justify-between border-t pt-1 text-xs font-semibold">
        <span>Subtotal — {title}</span>
        <span className="font-mono tabular-nums">{formatMoney(total)}</span>
      </div>
    </div>
  )
}

// ============== Income Statement ==============
function IncomeStatementReport({ from, to }: { from: string; to: string }) {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/income-statement?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [from, to])

  if (loading) return <Skeleton className="h-96 w-full" />
  if (!data) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income Statement</CardTitle>
        <CardDescription>For the period {formatDate(data.from)} to {formatDate(data.to)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-2xl mx-auto space-y-4">
          <ReportSection title="Revenue" items={data.revenue} total={data.totalRevenue} />
          <ReportSection title="Cost of Goods Sold" items={data.cogs} total={data.totalCogs} />
          <div className="flex justify-between border-t-2 pt-2 text-base font-bold">
            <span>Gross Profit</span>
            <span className="font-mono tabular-nums">{formatMoney(data.grossProfit)}</span>
          </div>
          <ReportSection title="Operating Expenses" items={data.operatingExpenses} total={data.totalOperating} />
          <div className="flex justify-between border-t-2 pt-2 text-base font-bold">
            <span>Operating Income</span>
            <span className="font-mono tabular-nums">{formatMoney(data.operatingIncome)}</span>
          </div>
          <ReportSection title="Other Income" items={data.otherIncome} total={data.totalOtherIncome} />
          <ReportSection title="Other Expenses" items={data.otherExpenses} total={data.totalOtherExpenses} />
          <div className="flex justify-between border-t-2 bg-muted/30 px-3 py-2 text-lg font-bold rounded">
            <span>Net Income</span>
            <span className="font-mono tabular-nums">{formatMoney(data.netIncome)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============== Cash Flow ==============
function CashFlowReport({ from, to }: { from: string; to: string }) {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/cash-flow?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [from, to])

  if (loading) return <Skeleton className="h-96 w-full" />
  if (!data) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Statement</CardTitle>
        <CardDescription>Indirect method · For the period {formatDate(data.from)} to {formatDate(data.to)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-semibold">Operating Activities</div>
            <div className="flex justify-between text-sm pl-2">
              <span>Net Income</span>
              <span className="font-mono tabular-nums">{formatMoney(data.netIncome)}</span>
            </div>
            {data.operatingAdjustments.map((a: any) => (
              <div key={a.code} className="flex justify-between text-xs pl-4">
                <span className="text-muted-foreground">{a.name}</span>
                <span className="font-mono tabular-nums">{formatMoney(a.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1 text-sm font-semibold">
              <span>Cash from Operating Activities</span>
              <span className="font-mono tabular-nums">{formatMoney(data.cashFromOperating)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold">Investing Activities</div>
            {data.investing.length === 0 ? (
              <div className="text-xs text-muted-foreground pl-2">No investing activity</div>
            ) : (
              data.investing.map((a: any) => (
                <div key={a.code} className="flex justify-between text-xs pl-4">
                  <span className="text-muted-foreground">{a.name}</span>
                  <span className="font-mono tabular-nums">{formatMoney(a.amount)}</span>
                </div>
              ))
            )}
            <div className="flex justify-between border-t pt-1 text-sm font-semibold">
              <span>Cash from Investing Activities</span>
              <span className="font-mono tabular-nums">{formatMoney(data.cashFromInvesting)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold">Financing Activities</div>
            {data.financing.length === 0 ? (
              <div className="text-xs text-muted-foreground pl-2">No financing activity</div>
            ) : (
              data.financing.map((a: any) => (
                <div key={a.code} className="flex justify-between text-xs pl-4">
                  <span className="text-muted-foreground">{a.name}</span>
                  <span className="font-mono tabular-nums">{formatMoney(a.amount)}</span>
                </div>
              ))
            )}
            <div className="flex justify-between border-t pt-1 text-sm font-semibold">
              <span>Cash from Financing Activities</span>
              <span className="font-mono tabular-nums">{formatMoney(data.cashFromFinancing)}</span>
            </div>
          </div>

          <div className="flex justify-between border-t-2 bg-muted/30 px-3 py-2 text-lg font-bold rounded">
            <span>Net Change in Cash</span>
            <span className="font-mono tabular-nums">{formatMoney(data.netChangeInCash)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
