'use client'

import * as React from 'react'
import { DollarSign, Plus } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'

interface ExchangeRate {
  id: string; fromCurrency: string; toCurrency: string; rate: number; date: string
}

export function ExchangeRatesView() {
  const [rates, setRates] = React.useState<ExchangeRate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreate, setShowCreate] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    fetch('/api/exchange-rates').then((r) => r.json()).then((d) => setRates(d.exchangeRates || [])).finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  const currencies = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED']

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Treasury</span><span>·</span><span>{rates.length} rates</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Exchange Rates</h1>
        <p className="text-sm text-muted-foreground">Manage currency exchange rates for multi-currency transactions.</p></div>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Rate</Button>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="p-4 space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        : rates.length === 0 ? <EmptyState icon={DollarSign} title="No exchange rates yet" description="Add exchange rates to support multi-currency transactions." action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Rate</Button>} />
        : <div className="divide-y">{rates.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent"><DollarSign className="h-4 w-4" /></div>
              <div className="flex-1"><div className="text-sm font-medium">1 {r.fromCurrency} = {(r.rate / 100).toFixed(4)} {r.toCurrency}</div>
                <div className="text-[11px] text-muted-foreground">Effective: {formatDate(r.date)}</div>
              </div>
            </div>
          ))}</div>}
      </CardContent></Card>

      <CreateFormDialog open={showCreate} onOpenChange={setShowCreate} title="Create Exchange Rate" description="Set the exchange rate between two currencies." apiEndpoint="/api/exchange-rates" successMessage="Exchange rate created" onSuccess={() => setTimeout(() => load(), 100)} fields={[
        { key: 'fromCurrency', label: 'From Currency', type: 'select', required: true, options: currencies.map((c) => ({ value: c, label: c })), defaultValue: 'USD' },
        { key: 'toCurrency', label: 'To Currency', type: 'select', required: true, options: currencies.map((c) => ({ value: c, label: c })), defaultValue: 'EGP' },
        { key: 'rate', label: 'Rate', type: 'number', required: true, placeholder: '48.50', helpText: 'e.g. 1 USD = 48.50 EGP → enter 48.50' },
        { key: 'date', label: 'Effective Date', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
      ]} />
    </div>
  )
}
