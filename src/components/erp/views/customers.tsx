'use client'

import * as React from 'react'
import { Users, Plus, Search, AlertTriangle, Clock } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard } from '@/components/erp/kpi-card'

interface Customer {
  id: string
  customerNumber: string
  name: string
  contactName: string | null
  email: string | null
  paymentTerms: string | null
  balance: number
  creditLimit: number | null
  active: boolean
  invoices?: Array<{
    id: string
    invoiceNumber: string
    amount: number
    amountPaid: number
    status: string
    dueDate: string
  }>
}

interface Aging { current: number; d30: number; d60: number; d90: number; d90plus: number }

export function CustomersView() {
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [aging, setAging] = React.useState<Aging>({ current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 })
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/customers?withInvoices=1')
      .then((r) => r.json())
      .then((d) => {
        setCustomers(d.customers || [])
        setAging(d.aging || { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 })
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = customers.filter((c) =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.customerNumber.toLowerCase().includes(search.toLowerCase()),
  )
  const totalAR = customers.reduce((s, c) => s + c.balance, 0)
  const overdueCount = customers.reduce(
    (s, c) => s + (c.invoices ?? []).filter((i) => new Date(i.dueDate) < new Date('2026-08-24') && i.amountPaid < i.amount).length,
    0,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Accounts Receivable</span>
            <span>·</span>
            <span>{customers.length} customers</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Track receivables, customer balances, and invoice aging.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Customer
        </Button>
      </div>

      <CreateFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title="Create New Customer"
        description="Add a customer to your accounts receivable."
        apiEndpoint="/api/customers"
        successMessage="Customer created successfully"
        onSuccess={() => setTimeout(() => load(), 100)}
        fields={[
          { key: 'customerNumber', label: 'Customer Number', type: 'text', required: true, placeholder: 'C-001' },
          { key: 'name', label: 'Customer Name', type: 'text', required: true, placeholder: 'Northwind Traders' },
          { key: 'contactName', label: 'Contact Name', type: 'text', placeholder: 'Eric Lin' },
          { key: 'email', label: 'Email', type: 'email', placeholder: 'ap@customer.com' },
          { key: 'phone', label: 'Phone', type: 'text', placeholder: '+1 555-0100' },
          { key: 'address', label: 'Address', type: 'text', placeholder: '456 Oak Ave, City, ST 12345' },
          { key: 'taxId', label: 'Tax ID', type: 'text', placeholder: 'EIN / VAT number' },
          { key: 'paymentTerms', label: 'Payment Terms', type: 'select', options: [
            { value: 'Net 15', label: 'Net 15' },
            { value: 'Net 30', label: 'Net 30' },
            { value: 'Net 45', label: 'Net 45' },
            { value: 'Net 60', label: 'Net 60' },
          ], defaultValue: 'Net 30' },
          { key: 'creditLimit', label: 'Credit Limit (USD)', type: 'number', placeholder: '50000', helpText: 'Enter amount in dollars (e.g. 50000)' },
          { key: 'currency', label: 'Currency', type: 'select', options: [
            { value: 'USD', label: 'USD — US Dollar' },
            { value: 'EUR', label: 'EUR — Euro' },
            { value: 'GBP', label: 'GBP — British Pound' },
          ], defaultValue: 'USD' },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Receivables" value={formatMoney(totalAR)} icon={<Users className="h-4 w-4" />} variant="success" />
        <KpiCard label="Active Customers" value={String(customers.filter((c) => c.active).length)} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Overdue Invoices" value={String(overdueCount)} hint="past due date" icon={<AlertTriangle className="h-4 w-4" />} />
        <KpiCard label="Current (not yet due)" value={formatMoney(aging.current)} icon={<Clock className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(['current', 'd30', 'd60', 'd90', 'd90plus'] as const).map((k, i) => {
          const labels = ['Current', '1–30 days', '31–60 days', '61–90 days', '90+ days']
          const colors = ['', 'text-amber-600', 'text-orange-600', 'text-red-600', 'text-destructive']
          return (
            <Card key={k} className="p-3">
              <div className="text-xs text-muted-foreground">{labels[i]}</div>
              <div className={`font-mono text-lg font-semibold tabular-nums ${colors[i]}`}>{formatMoney(aging[k])}</div>
            </Card>
          )
        })}
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-[6rem_1fr_8rem_8rem_8rem_5rem_8rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <div>Number</div>
            <div>Customer</div>
            <div>Terms</div>
            <div className="text-right">Balance</div>
            <div className="text-right">Credit Limit</div>
            <div>Status</div>
            <div className="text-right">Invoices</div>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : (
            filtered.map((c) => {
              const creditUtilization = c.creditLimit ? (c.balance / c.creditLimit) * 100 : 0
              return (
                <div key={c.id} className="grid grid-cols-[6rem_1fr_8rem_8rem_8rem_5rem_8rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm hover:bg-accent/5">
                  <div className="font-mono text-xs text-muted-foreground">{c.customerNumber}</div>
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">{c.contactName || c.email || '—'}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{c.paymentTerms || '—'}</div>
                  <div className="text-right font-mono text-xs tabular-nums">{formatMoney(c.balance)}</div>
                  <div className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {c.creditLimit ? formatMoney(c.creditLimit) : '—'}
                    {c.creditLimit && creditUtilization > 80 && (
                      <div className="text-[9px] text-amber-600">{creditUtilization.toFixed(0)}% used</div>
                    )}
                  </div>
                  <div>
                    {c.active ? (
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">{c.invoices?.length ?? 0} invoices</div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
