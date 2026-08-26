'use client'

import * as React from 'react'
import { Clock, Plus, TrendingUp } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'
import { KpiCard } from '@/components/erp/kpi-card'

interface Timesheet {
  id: string; employeeName: string; date: string; hours: number
  description: string | null; billableRate: number; status: string
  project: { name: string } | null
}

export function TimesheetsView() {
  const [timesheets, setTimesheets] = React.useState<Timesheet[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreate, setShowCreate] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    fetch('/api/timesheets').then((r) => r.json()).then((d) => setTimesheets(d.timesheets || [])).finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  const totalHours = timesheets.reduce((s, t) => s + t.hours, 0) / 100
  const totalBillable = timesheets.reduce((s, t) => s + (t.hours / 100) * t.billableRate, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Projects</span><span>·</span><span>{timesheets.length} entries</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Timesheets</h1>
        <p className="text-sm text-muted-foreground">Track employee time, billable hours, and project costs.</p></div>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Entry</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="Total Hours" value={totalHours.toFixed(1) + ' hrs'} icon={<Clock className="h-4 w-4" />} />
        <KpiCard label="Total Billable" value={formatMoney(totalBillable)} icon={<TrendingUp className="h-4 w-4" />} variant="success" />
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="p-4 space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        : timesheets.length === 0 ? <EmptyState icon={Clock} title="No timesheet entries yet" description="Record time spent on projects to track billable hours." action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Entry</Button>} />
        : <div className="overflow-x-auto"><div className="grid grid-cols-[1fr_6rem_6rem_6rem_5rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-w-[700px]"><div>Employee</div><div>Date</div><div className="text-right">Hours</div><div className="text-right">Billable</div><div>Status</div></div>
          {timesheets.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_6rem_6rem_6rem_5rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm hover:bg-accent/5 min-w-[700px]">
              <div><div className="font-medium text-sm">{t.employeeName}</div><div className="text-xs text-muted-foreground">{t.project?.name || 'No project'}</div></div>
              <div className="text-xs text-muted-foreground">{formatDate(t.date)}</div>
              <div className="text-right font-mono text-xs tabular-nums">{(t.hours / 100).toFixed(1)}h</div>
              <div className="text-right font-mono text-xs tabular-nums">{t.billableRate > 0 ? formatMoney((t.hours / 100) * t.billableRate) : '—'}</div>
              <div><Badge variant="outline" className="text-[10px]">{t.status}</Badge></div>
            </div>
          ))}</div>}
      </CardContent></Card>

      <CreateFormDialog open={showCreate} onOpenChange={setShowCreate} title="New Timesheet Entry" description="Record time spent on a project or task." apiEndpoint="/api/timesheets" successMessage="Timesheet entry created" onSuccess={() => setTimeout(() => load(), 100)} fields={[
        { key: 'employeeName', label: 'Employee Name', type: 'text', required: true, placeholder: 'John Smith' },
        { key: 'date', label: 'Date', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        { key: 'hours', label: 'Hours', type: 'number', required: true, placeholder: '8.0', helpText: 'Enter hours (e.g. 8.0 for a full day)' },
        { key: 'description', label: 'Description', type: 'text', placeholder: 'Implemented journal import feature' },
        { key: 'billableRate', label: 'Billable Rate (per hour)', type: 'number', placeholder: '50', helpText: 'Leave 0 for non-billable time' },
      ]} />
    </div>
  )
}
