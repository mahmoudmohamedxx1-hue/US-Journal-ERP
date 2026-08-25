'use client'

import * as React from 'react'
import { TrendingUp, Plus, Download } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'
import { exportToCsv } from '@/lib/csv-export'

interface SalesOrder {
  id: string; soNumber: string; orderDate: string; expectedDate: string | null
  status: string; totalAmount: number; notes: string | null
  customer: { name: string }; lines: Array<{ description: string; quantity: number; unitPrice: number }>
}

export function SalesOrdersView() {
  const [orders, setOrders] = React.useState<SalesOrder[]>([])
  const [customers, setCustomers] = React.useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreate, setShowCreate] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    Promise.all([fetch('/api/sales-orders').then((r) => r.json()), fetch('/api/customers').then((r) => r.json())])
      .then(([soData, custData]) => { setOrders(soData.salesOrders || []); setCustomers((custData.customers || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))) })
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Sales</span><span>·</span><span>{orders.length} orders</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales Orders</h1>
        <p className="text-sm text-muted-foreground">Create and track sales orders from customers.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCsv(`sales-orders-${Date.now()}.csv`, orders as unknown as Array<Record<string, unknown>>, [{ key: 'soNumber', label: 'SO Number' }, { key: 'customer.name', label: 'Customer' }, { key: 'orderDate', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'totalAmount', label: 'Total (cents)' }])}><Download className="mr-1.5 h-3.5 w-3.5" />Export CSV</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Sales Order</Button>
        </div>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="p-4 space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        : orders.length === 0 ? <EmptyState icon={TrendingUp} title="No sales orders yet" description="Create your first sales order to start tracking customer orders." action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Sales Order</Button>} />
        : <div className="overflow-x-auto"><div className="grid grid-cols-[8rem_1fr_8rem_8rem_8rem_5rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-w-[800px]"><div>SO Number</div><div>Customer</div><div>Date</div><div>Expected</div><div className="text-right">Total</div><div>Status</div></div>
          {orders.map((so) => (
            <div key={so.id} className="grid grid-cols-[8rem_1fr_8rem_8rem_8rem_5rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm hover:bg-accent/5 min-w-[800px]">
              <div className="font-mono text-xs">{so.soNumber}</div>
              <div className="truncate">{so.customer?.name || '—'}</div>
              <div className="text-xs text-muted-foreground">{formatDate(so.orderDate)}</div>
              <div className="text-xs text-muted-foreground">{so.expectedDate ? formatDate(so.expectedDate) : '—'}</div>
              <div className="text-right font-mono text-xs tabular-nums">{formatMoney(so.totalAmount)}</div>
              <div><Badge variant="outline" className="text-[10px]">{so.status}</Badge></div>
            </div>
          ))}</div>}
      </CardContent></Card>

      <CreateFormDialog open={showCreate} onOpenChange={setShowCreate} title="Create Sales Order" description="Create a sales order for a customer." apiEndpoint="/api/sales-orders" successMessage="Sales order created" onSuccess={() => setTimeout(() => load(), 100)} fields={[
        { key: 'soNumber', label: 'SO Number', type: 'text', required: true, placeholder: 'SO-001' },
        { key: 'customerId', label: 'Customer', type: 'select', required: true, options: customers.map((c) => ({ value: c.id, label: c.name })) },
        { key: 'orderDate', label: 'Order Date', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        { key: 'expectedDate', label: 'Expected Date', type: 'date' },
        { key: 'notes', label: 'Notes', type: 'text', placeholder: 'Delivery instructions' },
      ]} />
    </div>
  )
}
