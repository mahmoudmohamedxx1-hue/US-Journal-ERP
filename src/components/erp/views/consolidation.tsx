'use client'
import * as React from 'react'
import { Building2, Plus, Network } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'
import { KpiCard } from '@/components/erp/kpi-card'

export function ConsolidationView() {
  const [subs, setSubs] = React.useState<Array<{id:string;name:string;currency:string;active:boolean}>>([])
  const [txns, setTxns] = React.useState<Array<{id:string;txnNumber:string;txnDate:string;amount:number;currency:string;status:string;fromSubsidiary:{name:string};toSubsidiary:{name:string}}>>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreateSub, setShowCreateSub] = React.useState(false)
  const [showCreateTxn, setShowCreateTxn] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    Promise.all([fetch('/api/subsidiaries').then(r=>r.json()), fetch('/api/intercompany').then(r=>r.json())])
      .then(([subData, txnData]) => { setSubs(subData.subsidiaries||[]); setTxns(txnData.intercompanyTxns||[]) })
      .finally(() => setLoading(false))
  }, [])
  React.useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Multi-Company</span><span>·</span><span>{subs.length} subsidiaries</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Consolidation & Intercompany</h1>
        <p className="text-sm text-muted-foreground">Manage subsidiaries and intercompany transactions.</p></div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCreateTxn(true)}><Network className="mr-1.5 h-3.5 w-3.5" />New Intercompany</Button>
          <Button size="sm" onClick={() => setShowCreateSub(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Subsidiary</Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="Active Subsidiaries" value={String(subs.filter(s=>s.active).length)} icon={<Building2 className="h-4 w-4" />} />
        <KpiCard label="Intercompany Transactions" value={String(txns.length)} icon={<Network className="h-4 w-4" />} />
      </div>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-4"><Skeleton className="h-9 w-full" /></div>
        : subs.length === 0 ? <EmptyState icon={Building2} title="No subsidiaries" description="Add subsidiaries to enable multi-company consolidation." action={<Button size="sm" onClick={() => setShowCreateSub(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Subsidiary</Button>} />
        : <div className="divide-y">{subs.map(s => (<div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/5"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent"><Building2 className="h-4 w-4" /></div><div className="flex-1"><div className="text-sm font-medium">{s.name}</div><div className="text-[11px] text-muted-foreground">{s.currency} {s.taxId ? `· Tax: ${s.taxId}` : ''}</div></div><Badge variant="outline" className="text-[10px]">{s.active ? 'Active' : 'Inactive'}</Badge></div>))}</div>}
      </CardContent></Card>
      {txns.length > 0 && (<Card><CardContent className="p-0"><div className="border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Intercompany Transactions</div><div className="divide-y">{txns.map(t => (<div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/5"><div className="flex-1"><div className="text-sm font-medium">{t.txnNumber}</div><div className="text-[11px] text-muted-foreground">{t.fromSubsidiary?.name} → {t.toSubsidiary?.name} · {formatDate(t.txnDate)}</div></div><div className="text-right font-mono text-sm tabular-nums">{formatMoney(t.amount, t.currency)}</div><Badge variant="outline" className="text-[10px]">{t.status}</Badge></div>))}</div></CardContent></Card>)}
      <CreateFormDialog open={showCreateSub} onOpenChange={setShowCreateSub} title="New Subsidiary" apiEndpoint="/api/subsidiaries" successMessage="Subsidiary created" onSuccess={() => setTimeout(()=>load(),100)} fields={[{key:'name',label:'Subsidiary Name',type:'text',required:true,placeholder:'Subsidiary Co.'},{key:'legalName',label:'Legal Name',type:'text'},{key:'taxId',label:'Tax ID',type:'text'},{key:'currency',label:'Currency',type:'select',options:[{value:'EGP',label:'EGP'},{value:'USD',label:'USD'},{value:'EUR',label:'EUR'},{value:'SAR',label:'SAR'},{value:'AED',label:'AED'}],defaultValue:'EGP'}]} />
      <CreateFormDialog open={showCreateTxn} onOpenChange={setShowCreateTxn} title="New Intercompany Transaction" apiEndpoint="/api/intercompany" successMessage="Intercompany transaction created" onSuccess={() => setTimeout(()=>load(),100)} fields={[{key:'fromSubsidiaryId',label:'From Subsidiary',type:'select',required:true,options:subs.map(s=>({value:s.id,label:s.name}))},{key:'toSubsidiaryId',label:'To Subsidiary',type:'select',required:true,options:subs.map(s=>({value:s.id,label:s.name}))},{key:'amount',label:'Amount',type:'number',required:true,placeholder:'10000'},{key:'txnDate',label:'Transaction Date',type:'date',required:true,defaultValue:new Date().toISOString().slice(0,10)},{key:'description',label:'Description',type:'text',placeholder:'Intercompany loan / service charge'},{key:'currency',label:'Currency',type:'select',options:[{value:'EGP',label:'EGP'},{value:'USD',label:'USD'}],defaultValue:'EGP'}]} />
    </div>
  )
}
