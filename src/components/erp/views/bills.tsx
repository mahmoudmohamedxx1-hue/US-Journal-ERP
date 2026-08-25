'use client'

import * as React from 'react'
import { Receipt, Plus, Download, AlertTriangle } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard } from '@/components/erp/kpi-card'
import { exportToCsv } from '@/lib/csv-export'

interface Bill {
  id: string
  billNumber: string
  billDate: string
  dueDate: string
  amount: number
  amountPaid: number
  status: string
  description: string | null
  vendor: { id: string; name: string }
}

export function BillsView() {
  const [bills, setBills] = React.useState<Bill[]>([])
  const [vendors, setVendors] = React.useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/bills').then((r) => r.json()),
      fetch('/api/vendors').then((r) => r.json()),
    ])
      .then(([billData, vendData]) => {
        setBills(billData.bills || [])
        setVendors((vendData.vendors || []).map((v: { id: string; name: string }) => ({ id: v.id, name: v.name })))
      })
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  const totalOpen = bills.filter((b) => b.status !== 'Paid').reduce((s, b) => s + (b.amount - b.amountPaid), 0)
  const totalOverdue = bills.filter((b) => b.status === 'Overdue').reduce((s, b) => s + (b.amount - b.amountPaid), 0)
  const totalPaid = bills.reduce((s, b) => s + b.amountPaid, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Accounts Payable</span>
            <span>·</span>
            <span>{bills.length} bills</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
          <p className="text-sm text-muted-foreground">Track vendor bills, payments, and overdue balances.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCsv(`bills-${new Date().toISOString().slice(0, 10)}.csv`, bills as unknown as Array<Record<string, unknown>>, [
            { key: 'billNumber', label: 'Bill Number' },
            { key: 'vendor.name', label: 'Vendor' },
            { key: 'billDate', label: 'Date' },
            { key: 'dueDate', label: 'Due Date' },
            { key: 'amount', label: 'Amount (cents)' },
            { key: 'amountPaid', label: 'Paid (cents)' },
            { key: 'status', label: 'Status' },
          ])}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Bill
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Open AP" value={formatMoney(totalOpen)} icon={<Receipt className="h-4 w-4" />} />
        <KpiCard label="Overdue" value={formatMoney(totalOverdue)} icon={<AlertTriangle className="h-4 w-4" />} variant={totalOverdue > 0 ? 'danger' : 'default'} />
        <KpiCard label="Paid" value={formatMoney(totalPaid)} icon={<Receipt className="h-4 w-4" />} variant="success" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : bills.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <div className="mt-2 text-sm font-medium">No bills yet</div>
              <div className="mt-1 text-xs text-muted-foreground">Create your first bill to start tracking payables.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[8rem_1fr_8rem_8rem_8rem_5rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-w-[800px]">
                <div>Number</div>
                <div>Vendor</div>
                <div>Date</div>
                <div>Due Date</div>
                <div className="text-right">Amount</div>
                <div>Status</div>
              </div>
              {bills.map((b) => (
                <div key={b.id} className="grid grid-cols-[8rem_1fr_8rem_8rem_8rem_5rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm hover:bg-accent/5 min-w-[800px]">
                  <div className="font-mono text-xs text-muted-foreground">{b.billNumber}</div>
                  <div className="truncate">{b.vendor?.name || '—'}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(b.billDate)}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(b.dueDate)}</div>
                  <div className="text-right font-mono text-xs tabular-nums">{formatMoney(b.amount)}</div>
                  <div>
                    {b.status === 'Paid' ? (
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">Paid</Badge>
                    ) : b.status === 'Overdue' ? (
                      <Badge variant="outline" className="text-[10px] text-red-700 border-red-200 bg-red-50">Overdue</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50">Open</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title="Create New Bill"
        description="Record a vendor bill."
        apiEndpoint="/api/bills"
        successMessage="Bill created successfully"
        onSuccess={() => setTimeout(() => load(), 100)}
        fields={[
          { key: 'billNumber', label: 'Bill Number', type: 'text', required: true, placeholder: 'BILL-001' },
          { key: 'vendorId', label: 'Vendor', type: 'select', required: true, options: vendors.map((v) => ({ value: v.id, label: v.name })) },
          { key: 'billDate', label: 'Bill Date', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
          { key: 'dueDate', label: 'Due Date', type: 'date', required: true, defaultValue: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) },
          { key: 'amount', label: 'Amount (USD)', type: 'number', required: true, placeholder: '3000', helpText: 'Enter amount in dollars' },
          { key: 'description', label: 'Description', type: 'text', placeholder: 'Office supplies — August' },
        ]}
      />
    </div>
  )
}
