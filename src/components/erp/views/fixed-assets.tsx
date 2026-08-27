'use client'

import * as React from 'react'
import { Building2, Plus, TrendingDown, Calculator } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'
import { RowActions } from '@/components/erp/row-actions'
import { toast } from 'sonner'
import { KpiCard } from '@/components/erp/kpi-card'

interface FixedAsset {
  id: string; assetNumber: string; name: string; description: string | null
  purchaseDate: string; purchaseCost: number; salvageValue: number; usefulLifeMonths: number
  depreciationMethod: string; currentBookValue: number; accumulatedDepreciation: number
  status: string; account: { code: string; name: string }
}

export function FixedAssetsView() {
  const [assets, setAssets] = React.useState<FixedAsset[]>([])
  const [accounts, setAccounts] = React.useState<Array<{ id: string; code: string; name: string }>>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreate, setShowCreate] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/fixed-assets').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
    ]).then(([assetData, acctData]) => {
      setAssets(assetData.fixedAssets || [])
      setAccounts((acctData.accounts || []).filter((a: { accountType: string }) => a.accountType === 'Asset').map((a: { id: string; code: string; name: string }) => ({ id: a.id, code: a.code, name: a.name })))
    }).finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  const totalCost = assets.reduce((s, a) => s + a.purchaseCost, 0)
  const totalDepreciation = assets.reduce((s, a) => s + a.accumulatedDepreciation, 0)
  const totalBookValue = assets.reduce((s, a) => s + a.currentBookValue, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Assets</span><span>·</span><span>{assets.length} assets</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Fixed Assets</h1>
        <p className="text-sm text-muted-foreground">Track fixed assets, calculate depreciation, and manage disposals.</p></div>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Asset</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total Cost" value={formatMoney(totalCost)} icon={<Building2 className="h-4 w-4" />} variant="accent" />
        <KpiCard label="Accumulated Depreciation" value={formatMoney(totalDepreciation)} icon={<TrendingDown className="h-4 w-4" />} variant="danger" />
        <KpiCard label="Net Book Value" value={formatMoney(totalBookValue)} icon={<Calculator className="h-4 w-4" />} variant="success" />
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="p-4 space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        : assets.length === 0 ? <EmptyState icon={Building2} title="No fixed assets yet" description="Register your first fixed asset to start tracking depreciation." action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Asset</Button>} />
        : <div className="overflow-x-auto"><div className="grid grid-cols-[6rem_1fr_6rem_6rem_6rem_6rem_5rem_2.5rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-w-[900px]"><div>Asset #</div><div>Name</div><div className="text-right">Cost</div><div className="text-right">Depreciation</div><div className="text-right">Book Value</div><div>Method</div><div>Status</div></div>
          {assets.map((a) => (
            <div key={a.id} className="grid grid-cols-[6rem_1fr_6rem_6rem_6rem_6rem_5rem_2.5rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm hover:bg-accent/5 min-w-[900px]">
              <div className="font-mono text-xs">{a.assetNumber}</div>
              <div className="truncate">{a.name}</div>
              <div className="text-right font-mono text-xs tabular-nums">{formatMoney(a.purchaseCost)}</div>
              <div className="text-right font-mono text-xs tabular-nums text-red-600">{formatMoney(a.accumulatedDepreciation)}</div>
              <div className="text-right font-mono text-xs tabular-nums text-emerald-600">{formatMoney(a.currentBookValue)}</div>
              <div className="text-xs text-muted-foreground">{a.depreciationMethod}</div>
              <div><Badge variant="outline" className="text-[10px]">{a.status}</Badge></div>
              <div><RowActions actions={[
                {label: "Depreciate", onClick: async () => {
                  const r = await fetch("/api/fixed-assets/depreciate", {
                    method: "POST", headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({period: new Date().toISOString().slice(0, 7)})
                  })
                  const d = await r.json()
                  if (r.ok) { toast.success("Depreciated " + d.assetsProcessed + " assets, total " + formatMoney(d.totalDepreciation)); load() }
                  else { toast.error(d.error || "Failed") }
                }},
              ]} /></div>
            </div>
          ))}</div>}
      </CardContent></Card>

      <CreateFormDialog open={showCreate} onOpenChange={setShowCreate} title="Create Fixed Asset" description="Register a fixed asset for depreciation tracking." apiEndpoint="/api/fixed-assets" successMessage="Fixed asset created" onSuccess={() => setTimeout(() => load(), 100)} fields={[
        { key: 'assetNumber', label: 'Asset Number', type: 'text', required: true, placeholder: 'FA-001' },
        { key: 'name', label: 'Asset Name', type: 'text', required: true, placeholder: 'Office Building' },
        { key: 'description', label: 'Description', type: 'text', placeholder: '5-story office building at 123 Main St' },
        { key: 'accountId', label: 'Asset Account', type: 'select', required: true, options: accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })) },
        { key: 'purchaseDate', label: 'Purchase Date', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        { key: 'purchaseCost', label: 'Purchase Cost', type: 'number', required: true, placeholder: '500000', helpText: 'Enter amount in base currency' },
        { key: 'salvageValue', label: 'Salvage Value', type: 'number', placeholder: '50000', helpText: 'Estimated residual value at end of useful life' },
        { key: 'usefulLifeMonths', label: 'Useful Life (months)', type: 'number', required: true, placeholder: '60', defaultValue: '60', helpText: 'e.g. 60 = 5 years' },
        { key: 'depreciationMethod', label: 'Depreciation Method', type: 'select', options: [
          { value: 'straight-line', label: 'Straight Line' },
          { value: 'declining-balance', label: 'Declining Balance' },
        ], defaultValue: 'straight-line' },
      ]} />
    </div>
  )
}
