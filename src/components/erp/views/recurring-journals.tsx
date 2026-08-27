'use client'

import * as React from 'react'
import { Repeat, Plus, Play, Pause, Zap } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'
import { toast } from 'sonner'

interface RecurringJournal {
  id: string; name: string; description: string | null; frequency: string
  nextRunDate: string; lastRunDate: string | null; status: string; template: string
}

export function RecurringJournalsView() {
  const [journals, setJournals] = React.useState<RecurringJournal[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreate, setShowCreate] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    fetch('/api/recurring-journals').then((r) => r.json()).then((d) => setJournals(d.recurringJournals || [])).finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Automation</span><span>·</span><span>{journals.length} recurring journals</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Recurring Journals</h1>
        <p className="text-sm text-muted-foreground">Automate repetitive journal entries like rent, depreciation, and salaries.</p></div>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Recurring Journal</Button>
        {journals.length > 0 && (
          <Button size="sm" variant="outline" onClick={async () => {
            const res = await fetch('/api/recurring-journals/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
            const d = await res.json()
            if (res.ok) {
              const r = d.results || d.result
              if (r?.executed !== undefined) {
                toast.success(`Executed ${r.executed} recurring journals (${r.failed} failed)`)
              } else if (r?.executed) {
                toast.success(r.message || 'Recurring journal executed')
              }
              load()
            } else {
              toast.error(d.error || 'Failed')
            }
          }}><Zap className="mr-1.5 h-3.5 w-3.5" />Execute All Due</Button>
        )}
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="p-4 space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        : journals.length === 0 ? <EmptyState icon={Repeat} title="No recurring journals yet" description="Create a recurring journal for monthly rent, depreciation, or other repeating entries." action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Recurring Journal</Button>} />
        : <div className="divide-y">{journals.map((j) => (
            <div key={j.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent shrink-0"><Repeat className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0"><div className="text-sm font-medium">{j.name}</div>
                <div className="text-[11px] text-muted-foreground">{j.frequency} · Next: {formatDate(j.nextRunDate)} · Last: {j.lastRunDate ? formatDate(j.lastRunDate) : 'Never'}</div>
                {j.description && <div className="text-xs text-muted-foreground mt-0.5">{j.description}</div>}
              </div>
              <Badge variant="outline" className={j.status === 'Active' ? 'text-emerald-700 border-emerald-200 bg-emerald-50 text-[10px]' : 'text-muted-foreground text-[10px]'}>{j.status}</Badge>
              <Button size="sm" variant="outline" className="h-7" onClick={async () => {
                const res = await fetch('/api/recurring-journals/execute', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ recurringJournalId: j.id })
                })
                const d = await res.json()
                if (res.ok) {
                  toast.success(d.result?.message || 'Recurring journal executed')
                  load()
                } else {
                  toast.error(d.error || 'Failed')
                }
              }}><Zap className="mr-1 h-3 w-3" />Execute</Button>
            </div>
          ))}</div>}
      </CardContent></Card>

      <CreateFormDialog open={showCreate} onOpenChange={setShowCreate} title="Create Recurring Journal" description="Set up a journal entry that repeats automatically." apiEndpoint="/api/recurring-journals" successMessage="Recurring journal created" onSuccess={() => setTimeout(() => load(), 100)} fields={[
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Monthly Office Rent' },
        { key: 'description', label: 'Description', type: 'text', placeholder: 'Rent for office space at 123 Main St' },
        { key: 'frequency', label: 'Frequency', type: 'select', required: true, options: [
          { value: 'DAILY', label: 'Daily' }, { value: 'WEEKLY', label: 'Weekly' },
          { value: 'MONTHLY', label: 'Monthly' }, { value: 'QUARTERLY', label: 'Quarterly' }, { value: 'YEARLY', label: 'Yearly' },
        ], defaultValue: 'MONTHLY' },
        { key: 'nextRunDate', label: 'Next Run Date', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        { key: 'template', label: 'Journal Template (JSON)', type: 'textarea', required: true, placeholder: '{"lines":[{"accountId":"...","debit":5000,"credit":0,"description":"Rent"}]}', helpText: 'JSON array of journal lines — each with accountId, debit, credit, description' },
      ]} />
    </div>
  )
}
