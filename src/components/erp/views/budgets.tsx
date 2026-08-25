'use client'

import * as React from 'react'
import { Target, Plus, TrendingUp, TrendingDown } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'
import { cn } from '@/lib/utils'

interface Budget {
  id: string; accountId: string; period: string; budgetAmount: number; actualAmount: number
  account: { code: string; name: string }
}

export function BudgetsView() {
  const [budgets, setBudgets] = React.useState<Budget[]>([])
  const [accounts, setAccounts] = React.useState<Array<{ id: string; code: string; name: string }>>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreate, setShowCreate] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    Promise.all([fetch('/api/budgets').then((r) => r.json()), fetch('/api/accounts').then((r) => r.json())])
      .then(([budData, acctData]) => { setBudgets(budData.budgets || []); setAccounts((acctData.accounts || []).filter((a: { accountType: string; subType: string | null }) => a.accountType === 'Expense' || a.accountType === 'Revenue').map((a: { id: string; code: string; name: string }) => ({ id: a.id, code: a.code, name: a.name }))) })
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  const totalBudget = budgets.reduce((s, b) => s + b.budgetAmount, 0)
  const totalActual = budgets.reduce((s, b) => s + b.actualAmount, 0)
  const variance = totalBudget - totalActual

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Planning</span><span>·</span><span>{budgets.length} budgets</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
        <p className="text-sm text-muted-foreground">Set budget targets per account and period, then compare against actuals.</p></div>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Budget</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total Budget</div><div className="font-mono text-xl font-semibold tabular-nums">{formatMoney(totalBudget)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total Actual</div><div className="font-mono text-xl font-semibold tabular-nums">{formatMoney(totalActual)}</div></Card>
        <Card className={cn('p-4', variance >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50')}>
          <div className="text-xs text-muted-foreground">Variance</div>
          <div className={cn('font-mono text-xl font-semibold tabular-nums flex items-center gap-1', variance >= 0 ? 'text-emerald-700' : 'text-red-700')}>
            {variance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {formatMoney(Math.abs(variance))}
          </div>
        </Card>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="p-4 space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        : budgets.length === 0 ? <EmptyState icon={Target} title="No budgets yet" description="Create a budget for an account and period to start tracking variance." action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Budget</Button>} />
        : <div className="overflow-x-auto"><div className="grid grid-cols-[5rem_1fr_6rem_6rem_6rem_6rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-w-[700px]"><div>Code</div><div>Account</div><div className="text-right">Budget</div><div className="text-right">Actual</div><div className="text-right">Variance</div><div>Period</div></div>
          {budgets.map((b) => {
            const v = b.budgetAmount - b.actualAmount
            const pct = b.budgetAmount > 0 ? (b.actualAmount / b.budgetAmount) * 100 : 0
            return (
              <div key={b.id} className="grid grid-cols-[5rem_1fr_6rem_6rem_6rem_6rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm hover:bg-accent/5 min-w-[700px]">
                <div className="font-mono text-xs">{b.account?.code || '—'}</div>
                <div className="truncate">{b.account?.name || '—'}</div>
                <div className="text-right font-mono text-xs tabular-nums">{formatMoney(b.budgetAmount)}</div>
                <div className="text-right font-mono text-xs tabular-nums">{formatMoney(b.actualAmount)}</div>
                <div className={cn('text-right font-mono text-xs tabular-nums font-medium', v >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatMoney(v)}</div>
                <div><Badge variant="outline" className="text-[10px]">{b.period}</Badge></div>
              </div>
            )
          })}</div>}
      </CardContent></Card>

      <CreateFormDialog open={showCreate} onOpenChange={setShowCreate} title="Create Budget" description="Set a budget target for an account and period." apiEndpoint="/api/budgets" successMessage="Budget created" onSuccess={() => setTimeout(() => load(), 100)} fields={[
        { key: 'accountId', label: 'Account', type: 'select', required: true, options: accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })) },
        { key: 'period', label: 'Period', type: 'text', required: true, placeholder: '2026', helpText: 'Use "2026" for full year or "2026-01" for January' },
        { key: 'budgetAmount', label: 'Budget Amount (USD)', type: 'number', required: true, placeholder: '50000', helpText: 'Enter amount in dollars' },
      ]} />
    </div>
  )
}
