'use client'

import * as React from 'react'
import { ShoppingCart, Plus, Download } from 'lucide-react'
import { formatMoney, formatDate, STATUS_META } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'
import { exportToCsv } from '@/lib/csv-export'

interface PurchaseOrder {
  id: string; poNumber: string; orderDate: string; expectedDate: string | null
  status: string; totalAmount: number; notes: string | null
  vendor: { name: string }; lines: Array<{ description: string; quantity: number; unitPrice: number }>
}

export function PurchaseOrdersView() {
  const [orders, setOrders] = React.useState<PurchaseOrder[]>([])
  const [vendors, setVendors] = React.useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreate, setShowCreate] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    Promise.all([fetch('/api/purchase-orders').then((r) => r.json()), fetch('/api/vendors').then((r) => r.json())])
      .then(([poData, vendData]) => { setOrders(poData.purchaseOrders || []); setVendors((vendData.vendors || []).map((v: { id: string; name: string }) => ({ id: v.id, name: v.name }))) })
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Procurement</span><span>·</span><span>{orders.length} orders</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Purchase Orders</h1>
        <p className="text-sm text-muted-foreground">Create and track purchase orders to vendors.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCsv(`purchase-orders-${Date.now()}.csv`, orders as unknown as Array<Record<string, unknown>>, [{ key: 'poNumber', label: 'PO Number' }, { key: 'vendor.name', label: 'Vendor' }, { key: 'orderDate', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'totalAmount', label: 'Total (cents)' }])}><Download className="mr-1.5 h-3.5 w-3.5" />Export CSV</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Purchase Order</Button>
        </div>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="p-4 space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        : orders.length === 0 ? <EmptyState icon={ShoppingCart} title="No purchase orders yet" description="Create your first purchase order to start procuring goods." action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Purchase Order</Button>} />
        : <div className="overflow-x-auto"><div className="grid grid-cols-[8rem_1fr_8rem_8rem_8rem_5rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-w-[800px]"><div>PO Number</div><div>Vendor</div><div>Date</div><div>Expected</div><div className="text-right">Total</div><div>Status</div></div>
          {orders.map((po) => (
            <div key={po.id} className="grid grid-cols-[8rem_1fr_8rem_8rem_8rem_5rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm hover:bg-accent/5 min-w-[800px]">
              <div className="font-mono text-xs">{po.poNumber}</div>
              <div className="truncate">{po.vendor?.name || '—'}</div>
              <div className="text-xs text-muted-foreground">{formatDate(po.orderDate)}</div>
              <div className="text-xs text-muted-foreground">{po.expectedDate ? formatDate(po.expectedDate) : '—'}</div>
              <div className="text-right font-mono text-xs tabular-nums">{formatMoney(po.totalAmount)}</div>
              <div><Badge variant="outline" className="text-[10px]">{po.status}</Badge></div>
            </div>
          ))}</div>}
      </CardContent></Card>

      <CreateFormDialog open={showCreate} onOpenChange={setShowCreate} title="Create Purchase Order" description="Create a purchase order to a vendor." apiEndpoint="/api/purchase-orders" successMessage="Purchase order created" onSuccess={() => setTimeout(() => load(), 100)} fields={[
        { key: 'poNumber', label: 'PO Number', type: 'text', required: true, placeholder: 'PO-001' },
        { key: 'vendorId', label: 'Vendor', type: 'select', required: true, options: vendors.map((v) => ({ value: v.id, label: v.name })) },
        { key: 'orderDate', label: 'Order Date', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        { key: 'expectedDate', label: 'Expected Date', type: 'date' },
        { key: 'notes', label: 'Notes', type: 'text', placeholder: 'Delivery instructions' },
      ]} />
    </div>
  )
}
