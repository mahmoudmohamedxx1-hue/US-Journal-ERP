'use client'
import * as React from 'react'
import { Factory, Plus, Package, Settings } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'
import { KpiCard } from '@/components/erp/kpi-card'

export function ManufacturingView() {
  const [boms, setBoms] = React.useState<Array<{id:string;bomNumber:string;name:string;quantity:number;product:{name:string};lines:Array<{quantity:number;product:{name:string}}>}>>([])
  const [products, setProducts] = React.useState<Array<{id:string;name:string;sku:string}>>([])
  const [prodOrders, setProdOrders] = React.useState<Array<{id:string;productionNumber:string;quantity:number;status:string;startDate:string;product:{name:string}}>>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreateBOM, setShowCreateBOM] = React.useState(false)
  const [showCreatePO, setShowCreatePO] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    Promise.all([fetch('/api/boms').then(r=>r.json()), fetch('/api/products').then(r=>r.json()), fetch('/api/production-orders').then(r=>r.json())])
      .then(([bomData, prodData, poData]) => { setBoms(bomData.boms||[]); setProducts(prodData.products||[]); setProdOrders(poData.productionOrders||[]) })
      .finally(() => setLoading(false))
  }, [])
  React.useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Manufacturing</span><span>·</span><span>{boms.length} BOMs · {prodOrders.length} orders</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Manufacturing / MRP</h1>
        <p className="text-sm text-muted-foreground">Manage Bills of Materials (BOM), production orders, and cost tracking.</p></div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCreatePO(true)}><Package className="mr-1.5 h-3.5 w-3.5" />New Production Order</Button>
          <Button size="sm" onClick={() => setShowCreateBOM(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New BOM</Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Active BOMs" value={String(boms.length)} icon={<Settings className="h-4 w-4" />} />
        <KpiCard label="Production Orders" value={String(prodOrders.length)} icon={<Package className="h-4 w-4" />} />
        <KpiCard label="In Progress" value={String(prodOrders.filter(o=>o.status==='In Progress').length)} icon={<Factory className="h-4 w-4" />} />
      </div>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-4"><Skeleton className="h-9 w-full" /></div>
        : boms.length === 0 ? <EmptyState icon={Factory} title="No BOMs yet" description="Create a Bill of Materials to start manufacturing." action={<Button size="sm" onClick={() => setShowCreateBOM(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New BOM</Button>} />
        : <div className="overflow-x-auto"><div className="grid grid-cols-[6rem_1fr_4rem_1fr_4rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-w-[700px]"><div>BOM #</div><div>Product</div><div className="text-center">Qty</div><div>Components</div><div>Status</div></div>
          {boms.map(b => (<div key={b.id} className="grid grid-cols-[6rem_1fr_4rem_1fr_4rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm min-w-[700px]">
            <div className="font-mono text-xs">{b.bomNumber}</div><div className="font-medium">{b.product?.name||'—'}</div><div className="text-center text-xs">{b.quantity}</div>
            <div className="text-xs text-muted-foreground">{b.lines.map(l=>`${l.quantity}× ${l.product?.name||'?'}`).join(', ')||'—'}</div>
            <div><Badge variant="outline" className="text-[10px]">{b.status}</Badge></div>
          </div>))}</div>}
      </CardContent></Card>
      {prodOrders.length > 0 && (<Card><CardContent className="p-0"><div className="border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Production Orders</div><div className="divide-y">{prodOrders.map(o => (<div key={o.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/5"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent"><Package className="h-4 w-4" /></div><div className="flex-1"><div className="text-sm font-medium">{o.productionNumber}</div><div className="text-[11px] text-muted-foreground">{o.product?.name} · {o.quantity} units · {formatDate(o.startDate)}</div></div><Badge variant="outline" className="text-[10px]">{o.status}</Badge></div>))}</div></CardContent></Card>)}
      <CreateFormDialog open={showCreateBOM} onOpenChange={setShowCreateBOM} title="New Bill of Materials" apiEndpoint="/api/boms" successMessage="BOM created" onSuccess={() => setTimeout(()=>load(),100)} fields={[
        {key:'bomNumber',label:'BOM Number',type:'text',required:true,placeholder:'BOM-001'},
        {key:'name',label:'BOM Name',type:'text',required:true,placeholder:'Laptop Stand Assembly'},
        {key:'productId',label:'Finished Product',type:'select',required:true,options:products.map(p=>({value:p.id,label:`${p.sku} — ${p.name}`}))},
        {key:'quantity',label:'Output Quantity',type:'number',required:true,defaultValue:'1',placeholder:'1'},
        {key:'description',label:'Description',type:'text',placeholder:'Assembly instructions'},
      ]} />
      <CreateFormDialog open={showCreatePO} onOpenChange={setShowCreatePO} title="New Production Order" apiEndpoint="/api/production-orders" successMessage="Production order created" onSuccess={() => setTimeout(()=>load(),100)} fields={[
        {key:'productionNumber',label:'Production Number',type:'text',required:true,placeholder:'PROD-001'},
        {key:'bomId',label:'BOM',type:'select',required:true,options:boms.map(b=>({value:b.id,label:`${b.bomNumber} — ${b.name}`}))},
        {key:'productId',label:'Product to Produce',type:'select',required:true,options:products.map(p=>({value:p.id,label:`${p.sku} — ${p.name}`}))},
        {key:'quantity',label:'Quantity to Produce',type:'number',required:true,placeholder:'100'},
        {key:'startDate',label:'Start Date',type:'date',required:true,defaultValue:new Date().toISOString().slice(0,10)},
        {key:'endDate',label:'Expected End Date',type:'date'},
      ]} />
    </div>
  )
}
