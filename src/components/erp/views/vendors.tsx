'use client'

import * as React from 'react'
import {
  Receipt,
  Plus,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney, formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard } from '@/components/erp/kpi-card'
import { RowActions } from '@/components/erp/row-actions'
import { toast } from 'sonner'

interface Vendor {
  id: string
  vendorNumber: string
  name: string
  contactName: string | null
  email: string | null
  paymentTerms: string | null
  currency: string
  balance: number
  active: boolean
  bills?: Array<{
    id: string
    billNumber: string
    billDate: string
    dueDate: string
    amount: number
    amountPaid: number
    status: string
  }>
}

interface Aging { current: number; d30: number; d60: number; d90: number; d90plus: number }

export function VendorsView() {
  const [vendors, setVendors] = React.useState<Vendor[]>([])
  const [aging, setAging] = React.useState<Aging>({ current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 })
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/vendors?withBills=1')
      .then((r) => r.json())
      .then((d) => {
        setVendors(d.vendors || [])
        setAging(d.aging || { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 })
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = vendors.filter((v) =>
    !search ||
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.vendorNumber.toLowerCase().includes(search.toLowerCase()),
  )

  const totalAP = vendors.reduce((s, v) => s + v.balance, 0)
  const overdueCount = vendors.reduce(
    (s, v) => s + (v.bills ?? []).filter((b) => new Date(b.dueDate) < new Date('2026-08-24') && b.amountPaid < b.amount).length,
    0,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Accounts Payable</span>
            <span>·</span>
            <span>{vendors.length} vendors</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Track payables, vendor balances, and bill aging.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Vendor
        </Button>
      </div>

      <CreateFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title="Create New Vendor"
        description="Add a vendor to your accounts payable."
        apiEndpoint="/api/vendors"
        successMessage="Vendor created successfully"
        onSuccess={() => setTimeout(() => load(), 100)}
        fields={[
          { key: 'vendorNumber', label: 'Vendor Number', type: 'text', required: true, placeholder: 'V-001' },
          { key: 'name', label: 'Vendor Name', type: 'text', required: true, placeholder: 'Acme Corporation' },
          { key: 'contactName', label: 'Contact Name', type: 'text', placeholder: 'John Smith' },
          { key: 'email', label: 'Email', type: 'email', placeholder: 'ap@vendor.com' },
          { key: 'phone', label: 'Phone', type: 'text', placeholder: '+1 555-0100' },
          { key: 'address', label: 'Address', type: 'text', placeholder: '123 Main St, City, ST 12345' },
          { key: 'taxId', label: 'Tax ID', type: 'text', placeholder: 'EIN / VAT number' },
          { key: 'paymentTerms', label: 'Payment Terms', type: 'select', options: [
            { value: 'Net 15', label: 'Net 15' },
            { value: 'Net 30', label: 'Net 30' },
            { value: 'Net 45', label: 'Net 45' },
            { value: 'Net 60', label: 'Net 60' },
            { value: 'Due on receipt', label: 'Due on receipt' },
          ], defaultValue: 'Net 30' },
          { key: 'currency', label: 'Currency', type: 'select', options: [
            { value: 'EGP', label: 'EGP — Egyptian Pound' },
            { value: 'USD', label: 'USD — US Dollar' },
            { value: 'EUR', label: 'EUR — Euro' },
            { value: 'SAR', label: 'SAR — Saudi Riyal' },
            { value: 'AED', label: 'AED — UAE Dirham' },
            { value: 'GBP', label: 'GBP — British Pound' },
          ], defaultValue: 'EGP' },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Payables" value={formatMoney(totalAP)} icon={<Receipt className="h-4 w-4" />} variant="danger" />
        <KpiCard label="Active Vendors" value={String(vendors.filter((v) => v.active).length)} icon={<Receipt className="h-4 w-4" />} />
        <KpiCard label="Overdue Bills" value={String(overdueCount)} hint="past due date" icon={<AlertTriangle className="h-4 w-4" />} />
        <KpiCard label="Current (not yet due)" value={formatMoney(aging.current)} icon={<Clock className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Current</div>
          <div className="font-mono text-lg font-semibold tabular-nums">{formatMoney(aging.current)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">1–30 days</div>
          <div className="font-mono text-lg font-semibold tabular-nums text-amber-600">{formatMoney(aging.d30)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">31–60 days</div>
          <div className="font-mono text-lg font-semibold tabular-nums text-orange-600">{formatMoney(aging.d60)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">61–90 days</div>
          <div className="font-mono text-lg font-semibold tabular-nums text-red-600">{formatMoney(aging.d90)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">90+ days</div>
          <div className="font-mono text-lg font-semibold tabular-nums text-destructive">{formatMoney(aging.d90plus)}</div>
        </Card>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search vendors…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-[6rem_1fr_8rem_8rem_5rem_8rem_2.5rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <div>Number</div>
            <div>Vendor</div>
            <div>Terms</div>
            <div className="text-right">Balance</div>
            <div>Status</div>
            <div className="text-right">Bills</div>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : (
            filtered.map((v) => (
              <div key={v.id} className="grid grid-cols-[6rem_1fr_8rem_8rem_5rem_8rem_2.5rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm hover:bg-accent/5">
                <div className="font-mono text-xs text-muted-foreground">{v.vendorNumber}</div>
                <div>
                  <div className="font-medium">{v.name}</div>
                  <div className="text-[11px] text-muted-foreground">{v.contactName || v.email || '—'}</div>
                </div>
                <div className="text-xs text-muted-foreground">{v.paymentTerms || '—'}</div>
                <div className="text-right font-mono text-xs tabular-nums">{formatMoney(v.balance)}</div>
                <div>
                  {v.active ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground">{v.bills?.length ?? 0} bills</div>
                <div><RowActions actions={[
                  {label: "View Stats", onClick: async () => {
                    const r = await fetch(`/api/partners/stats?role=vendor&partyId=${v.id}`)
                    const d = await r.json()
                    const s = d.stats
                    toast.info(v.name + ": Balance " + formatMoney(s.balance) + ", " + s.openBillsCount + " open bills, " + s.overdueBillsCount + " overdue")
                  }},
                  {label: "Pay Vendor", onClick: async () => {
                    const r = await fetch(`/api/payments/register?partyType=VENDOR&partyId=${v.id}`)
                    const d = await r.json()
                    const items = d.openItems || []
                    if (items.length === 0) { toast.info(v.name + " has no open bills") }
                    else { toast.info(v.name + ": " + items.length + " open bills") }
                  }},
                ]} /></div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
