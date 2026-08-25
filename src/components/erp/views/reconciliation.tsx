'use client'

import * as React from 'react'
import { Landmark, Plus, CheckCircle2, Clock } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'

interface Reconciliation {
  id: string; statementDate: string; startingBalance: number
  endingBalance: number; status: string
  bankAccount: { id: string; accountName: string; balance: number }
}

export function ReconciliationView() {
  const [recs, setRecs] = React.useState<Reconciliation[]>([])
  const [banks, setBanks] = React.useState<Array<{ id: string; accountName: string }>>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreate, setShowCreate] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/reconciliations').then((r) => r.json()),
      fetch('/api/banking').then((r) => r.json()),
    ]).then(([recData, bankData]) => {
      setRecs(recData.reconciliations || [])
      setBanks((bankData.accounts || []).map((b: { id: string; accountName: string }) => ({ id: b.id, accountName: b.accountName })))
    }).finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Banking</span><span>·</span><span>{recs.length} sessions</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Bank Reconciliation</h1>
        <p className="text-sm text-muted-foreground">Match your bank statements with recorded transactions.</p></div>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Session</Button>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="p-4 space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        : recs.length === 0 ? <EmptyState icon={Landmark} title="No reconciliation sessions" description="Start your first bank reconciliation to match transactions." action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Session</Button>} />
        : <div className="divide-y">{recs.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent"><Landmark className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{r.bankAccount?.accountName || '—'}</div>
                <div className="text-[11px] text-muted-foreground">
                  Statement: {formatDate(r.statementDate)} · Start: {formatMoney(r.startingBalance)} → End: {formatMoney(r.endingBalance)}
                </div>
              </div>
              {r.status === 'Reconciled' ? (
                <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-2.5 w-2.5 mr-1" />Reconciled</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50"><Clock className="h-2.5 w-2.5 mr-1" />Open</Badge>
              )}
            </div>
          ))}</div>}
      </CardContent></Card>

      <CreateFormDialog open={showCreate} onOpenChange={setShowCreate} title="New Reconciliation Session" description="Start reconciling a bank account against a statement." apiEndpoint="/api/reconciliations" successMessage="Reconciliation session created" onSuccess={() => setTimeout(() => load(), 100)} fields={[
        { key: 'bankAccountId', label: 'Bank Account', type: 'select', required: true, options: banks.map((b) => ({ value: b.id, label: b.accountName })) },
        { key: 'statementDate', label: 'Statement Date', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        { key: 'startingBalance', label: 'Starting Balance (from statement)', type: 'number', required: true, placeholder: '50000' },
        { key: 'endingBalance', label: 'Ending Balance (from statement)', type: 'number', required: true, placeholder: '55000' },
      ]} />
    </div>
  )
}
