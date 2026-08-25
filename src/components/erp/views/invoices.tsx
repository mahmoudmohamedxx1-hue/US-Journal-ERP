'use client'

import * as React from 'react'
import { FileText, Plus, Download, AlertTriangle } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard } from '@/components/erp/kpi-card'
import { exportToCsv } from '@/lib/csv-export'

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  amount: number
  amountPaid: number
  status: string
  description: string | null
  customer: { id: string; name: string }
}

export function InvoicesView() {
  const [invoices, setInvoices] = React.useState<Invoice[]>([])
  const [customers, setCustomers] = React.useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/invoices').then((r) => r.json()),
      fetch('/api/customers').then((r) => r.json()),
    ])
      .then(([invData, custData]) => {
        setInvoices(invData.invoices || [])
        setCustomers((custData.customers || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      })
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  const totalOpen = invoices.filter((i) => i.status !== 'Paid').reduce((s, i) => s + (i.amount - i.amountPaid), 0)
  const totalOverdue = invoices.filter((i) => i.status === 'Overdue').reduce((s, i) => s + (i.amount - i.amountPaid), 0)
  const totalPaid = invoices.reduce((s, i) => s + i.amountPaid, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Accounts Receivable</span>
            <span>·</span>
            <span>{invoices.length} invoices</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Track customer invoices, payments, and overdue balances.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCsv(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, invoices as unknown as Array<Record<string, unknown>>, [
            { key: 'invoiceNumber', label: 'Invoice Number' },
            { key: 'customer.name', label: 'Customer' },
            { key: 'invoiceDate', label: 'Date' },
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
            New Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Open AR" value={formatMoney(totalOpen)} icon={<FileText className="h-4 w-4" />} />
        <KpiCard label="Overdue" value={formatMoney(totalOverdue)} icon={<AlertTriangle className="h-4 w-4" />} variant={totalOverdue > 0 ? 'danger' : 'default'} />
        <KpiCard label="Collected" value={formatMoney(totalPaid)} icon={<FileText className="h-4 w-4" />} variant="success" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <div className="mt-2 text-sm font-medium">No invoices yet</div>
              <div className="mt-1 text-xs text-muted-foreground">Create your first invoice to start tracking receivables.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[8rem_1fr_8rem_8rem_8rem_5rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-w-[800px]">
                <div>Number</div>
                <div>Customer</div>
                <div>Date</div>
                <div>Due Date</div>
                <div className="text-right">Amount</div>
                <div>Status</div>
              </div>
              {invoices.map((inv) => (
                <div key={inv.id} className="grid grid-cols-[8rem_1fr_8rem_8rem_8rem_5rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm hover:bg-accent/5 min-w-[800px]">
                  <div className="font-mono text-xs text-muted-foreground">{inv.invoiceNumber}</div>
                  <div className="truncate">{inv.customer?.name || '—'}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(inv.invoiceDate)}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(inv.dueDate)}</div>
                  <div className="text-right font-mono text-xs tabular-nums">{formatMoney(inv.amount)}</div>
                  <div>
                    {inv.status === 'Paid' ? (
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">Paid</Badge>
                    ) : inv.status === 'Overdue' ? (
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
        title="Create New Invoice"
        description="Create a customer invoice."
        apiEndpoint="/api/invoices"
        successMessage="Invoice created successfully"
        onSuccess={() => setTimeout(() => load(), 100)}
        fields={[
          { key: 'invoiceNumber', label: 'Invoice Number', type: 'text', required: true, placeholder: 'INV-001' },
          { key: 'customerId', label: 'Customer', type: 'select', required: true, options: customers.map((c) => ({ value: c.id, label: c.name })) },
          { key: 'invoiceDate', label: 'Invoice Date', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
          { key: 'dueDate', label: 'Due Date', type: 'date', required: true, defaultValue: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) },
          { key: 'amount', label: 'Amount (USD)', type: 'number', required: true, placeholder: '5000', helpText: 'Enter amount in dollars' },
          { key: 'description', label: 'Description', type: 'text', placeholder: 'Consulting services for August' },
        ]}
      />
    </div>
  )
}
