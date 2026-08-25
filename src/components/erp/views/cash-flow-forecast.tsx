'use client'

import * as React from 'react'
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, ReferenceLine } from 'recharts'
import { formatMoney, formatCompact } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard } from '@/components/erp/kpi-card'

interface ForecastMonth {
  month: string; inflow: number; outflow: number; net: number; projectedBalance: number
}

export function CashFlowForecastView() {
  const [data, setData] = React.useState<{ currentCash: number; forecast: ForecastMonth[]; openAR: number; openAP: number; recurringCount: number } | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/cash-flow-forecast').then((r) => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton className="h-96 w-full" />
  if (!data) return null

  const chartData = data.forecast.map((m) => ({
    month: m.month,
    Inflow: m.inflow / 100,
    Outflow: m.outflow / 100,
    Net: m.net / 100,
    Balance: m.projectedBalance / 100,
  }))

  const sixMonthNet = data.forecast.reduce((s, m) => s + m.net, 0)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">Forecasting</span>
          <span>·</span>
          <span>6-month projection</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Cash Flow Forecast</h1>
        <p className="text-sm text-muted-foreground">
          Projected cash position based on open invoices, bills, and recurring journals.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Current Cash" value={formatMoney(data.currentCash)} icon={<DollarSign className="h-4 w-4" />} variant="accent" />
        <KpiCard label="Open AR (incoming)" value={formatMoney(data.openAR)} icon={<TrendingUp className="h-4 w-4" />} variant="success" />
        <KpiCard label="Open AP (outgoing)" value={formatMoney(data.openAP)} icon={<TrendingDown className="h-4 w-4" />} variant="danger" />
        <KpiCard label="6-Month Net" value={formatMoney(sixMonthNet)} icon={<Calendar className="h-4 w-4" />} variant={sixMonthNet >= 0 ? 'success' : 'danger'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">6-Month Cash Flow Projection</CardTitle>
          <CardDescription>Based on AR due dates, AP due dates, and recurring journals</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => formatCompact(v * 100)} />
              <Tooltip formatter={(v: number) => formatMoney(v * 100)} contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Inflow" fill="var(--chart-3)" name="Inflow" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Outflow" fill="var(--chart-5)" name="Outflow" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net" fill="var(--chart-1)" name="Net" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Month-by-month table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Monthly Breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[6rem_1fr_1fr_1fr_1fr] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-w-[600px]">
              <div>Month</div><div className="text-right">Inflow</div><div className="text-right">Outflow</div><div className="text-right">Net</div><div className="text-right">Projected Balance</div>
            </div>
            {data.forecast.map((m, i) => (
              <div key={i} className="grid grid-cols-[6rem_1fr_1fr_1fr_1fr] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm min-w-[600px]">
                <div className="font-medium">{m.month}</div>
                <div className="text-right font-mono text-xs text-emerald-600 tabular-nums">{formatMoney(m.inflow)}</div>
                <div className="text-right font-mono text-xs text-red-600 tabular-nums">{formatMoney(m.outflow)}</div>
                <div className={cn('text-right font-mono text-xs font-medium tabular-nums', m.net >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatMoney(m.net)}</div>
                <div className={cn('text-right font-mono text-xs font-bold tabular-nums', m.projectedBalance >= 0 ? 'text-emerald-700' : 'text-red-700')}>{formatMoney(m.projectedBalance)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function cn(...args: (string | false | undefined)[]) {
  return args.filter(Boolean).join(' ')
}
