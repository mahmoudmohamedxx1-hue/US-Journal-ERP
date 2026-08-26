'use client'

import * as React from 'react'
import { Package, Plus, Download, AlertTriangle } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard } from '@/components/erp/kpi-card'
import { EmptyState } from '@/components/erp/empty-state'
import { exportToCsv } from '@/lib/csv-export'

interface Product {
  id: string; sku: string; name: string; category: string | null
  unit: string; costPrice: number; salePrice: number; stockQuantity: number
  reorderPoint: number; active: boolean
}

export function InventoryView() {
  const [products, setProducts] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreate, setShowCreate] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const load = React.useCallback(() => {
    setLoading(true)
    const q = search ? `?q=${encodeURIComponent(search)}` : ''
    fetch(`/api/products${q}`).then((r) => r.json()).then((d) => setProducts(d.products || [])).finally(() => setLoading(false))
  }, [search])

  React.useEffect(() => { load() }, [load])

  const totalStockValue = products.reduce((s, p) => s + p.stockQuantity * p.costPrice, 0)
  const lowStock = products.filter((p) => p.stockQuantity <= p.reorderPoint && p.reorderPoint > 0).length
  const totalItems = products.reduce((s, p) => s + p.stockQuantity, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Inventory</span><span>·</span><span>{products.length} products</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Products & Inventory</h1>
          <p className="text-sm text-muted-foreground">Manage products, track stock levels, and monitor reorder points.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCsv(`products-${Date.now()}.csv`, products as unknown as Array<Record<string, unknown>>, [
            { key: 'sku', label: 'SKU' }, { key: 'name', label: 'Name' }, { key: 'category', label: 'Category' },
            { key: 'stockQuantity', label: 'Stock' }, { key: 'reorderPoint', label: 'Reorder Point' },
            { key: 'costPrice', label: 'Cost (cents)' }, { key: 'salePrice', label: 'Sale Price (cents)' },
          ])}><Download className="mr-1.5 h-3.5 w-3.5" />Export CSV</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Product</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Stock Value" value={formatMoney(totalStockValue)} icon={<Package className="h-4 w-4" />} variant="accent" />
        <KpiCard label="Total Items" value={String(totalItems)} icon={<Package className="h-4 w-4" />} />
        <KpiCard label="Low Stock Alerts" value={String(lowStock)} icon={<AlertTriangle className="h-4 w-4" />} variant={lowStock > 0 ? 'danger' : 'default'} />
      </div>

      <input placeholder="Search products by name, SKU, or category…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-accent" />

      <Card><CardContent className="p-0">
        {loading ? <div className="p-4 space-y-2">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        : products.length === 0 ? <EmptyState icon={Package} title="No products yet" description="Create your first product to start tracking inventory." action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Product</Button>} />
        : <div className="overflow-x-auto">
            <div className="grid grid-cols-[6rem_1fr_6rem_5rem_6rem_6rem_5rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-w-[800px]">
              <div>SKU</div><div>Name</div><div>Category</div><div>Stock</div><div className="text-right">Cost</div><div className="text-right">Sale</div><div>Status</div>
            </div>
            {products.map((p) => (
              <div key={p.id} className="grid grid-cols-[6rem_1fr_6rem_5rem_6rem_6rem_5rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm hover:bg-accent/5 min-w-[800px]">
                <div className="font-mono text-xs">{p.sku}</div>
                <div className="truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.category || '—'}</div>
                <div className="text-xs">{p.stockQuantity} {p.unit}{p.stockQuantity <= p.reorderPoint && p.reorderPoint > 0 ? <span className="text-red-600 ml-1">⚠</span> : ''}</div>
                <div className="text-right font-mono text-xs tabular-nums">{formatMoney(p.costPrice)}</div>
                <div className="text-right font-mono text-xs tabular-nums">{formatMoney(p.salePrice)}</div>
                <div>{p.active ? <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">Active</Badge> : <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>}</div>
              </div>
            ))}
          </div>}
      </CardContent></Card>

      <CreateFormDialog open={showCreate} onOpenChange={setShowCreate} title="Create New Product" description="Add a product to your inventory." apiEndpoint="/api/products" successMessage="Product created" onSuccess={() => setTimeout(() => load(), 100)} fields={[
        { key: 'sku', label: 'SKU', type: 'text', required: true, placeholder: 'PROD-001' },
        { key: 'name', label: 'Product Name', type: 'text', required: true, placeholder: 'Laptop Stand' },
        { key: 'description', label: 'Description', type: 'text', placeholder: 'Aluminum adjustable laptop stand' },
        { key: 'category', label: 'Category', type: 'text', placeholder: 'Electronics' },
        { key: 'unit', label: 'Unit', type: 'select', options: [{ value: 'each', label: 'Each' }, { value: 'kg', label: 'Kilogram' }, { value: 'liter', label: 'Liter' }, { value: 'hour', label: 'Hour' }, { value: 'box', label: 'Box' }], defaultValue: 'each' },
        { key: 'costPrice', label: 'Cost Price (EGP)', type: 'number', placeholder: '25.00', helpText: 'Enter amount in EGP' },
        { key: 'salePrice', label: 'Sale Price (EGP)', type: 'number', placeholder: '49.99', helpText: 'Enter amount in EGP' },
        { key: 'stockQuantity', label: 'Initial Stock Quantity', type: 'number', placeholder: '100' },
        { key: 'reorderPoint', label: 'Reorder Point', type: 'number', placeholder: '10', helpText: 'Alert when stock drops to this level' },
      ]} />
    </div>
  )
}
