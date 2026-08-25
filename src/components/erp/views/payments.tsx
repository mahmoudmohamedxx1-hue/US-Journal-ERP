'use client'

import * as React from 'react'
import { CreditCard, Plus, Download, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'
import { exportToExcel } from '@/lib/export-utils'

interface Payment {
  id: string; paymentNumber: string; paymentDate: string; paymentType: string
  partyType: string; partyId: string; amount: number; currency: string
  reference: string | null; notes: string | null; status: string
  bankAccount: { accountName: string }
}

export function PaymentsView() {
  const [payments, setPayments] = React.useState<Payment[]>([])
  const [vendors, setVendors] = React.useState<Array<{ id: string; name: string }>>([])
  const [customers, setCustomers] = React.useState<Array<{ id: string; name: string }>>([])
  const [bankAccounts, setBankAccounts] = React.useState<Array<{ id: string; accountName: string }>>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreate, setShowCreate] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/payments').then((r) => r.json()),
      fetch('/api/vendors').then((r) => r.json()),
      fetch('/api/customers').then((r) => r.json()),
      fetch('/api/banking').then((r) => r.json()),
    ]).then(([payData, vendData, custData, bankData]) => {
      setPayments(payData.payments || [])
      setVendors((vendData.vendors || []).map((v: { id: string; name: string }) => ({ id: v.id, name: v.name })))
      setCustomers((custData.customers || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      setBankAccounts((bankData.accounts || []).map((b: { id: string; accountName: string }) => ({ id: b.id, accountName: b.accountName })))
    }).finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  const totalReceipts = payments.filter((p) => p.paymentType === 'RECEIPT').reduce((s, p) => s + p.amount, 0)
  const totalPayments = payments.filter((p) => p.paymentType === 'PAYMENT').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Treasury</span><span>·</span><span>{payments.length} payments</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">Record payments to vendors and receipts from customers.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToExcel(`payments-${Date.now()}`, payments as unknown as Array<Record<string, unknown>>, [
            { key: 'paymentNumber', label: 'Payment Number' }, { key: 'paymentDate', label: 'Date' },
            { key: 'paymentType', label: 'Type' }, { key: 'partyType', label: 'Party Type' },
            { key: 'amount', label: 'Amount (cents)' }, { key: 'currency', label: 'Currency' },
            { key: 'reference', label: 'Reference' }, { key: 'status', label: 'Status' },
          ])}><Download className="mr-1.5 h-3.5 w-3.5" />Export Excel</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Payment</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-600"><ArrowDownCircle className="h-4 w-4" /></div><div><div className="text-xs text-muted-foreground">Total Receipts (In)</div><div className="font-mono text-lg font-semibold tabular-nums">{formatMoney(totalReceipts)}</div></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-red-50 text-red-600"><ArrowUpCircle className="h-4 w-4" /></div><div><div className="text-xs text-muted-foreground">Total Payments (Out)</div><div className="font-mono text-lg font-semibold tabular-nums">{formatMoney(totalPayments)}</div></div></div></Card>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="p-4 space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        : payments.length === 0 ? <EmptyState icon={CreditCard} title="No payments yet" description="Record your first payment to a vendor or receipt from a customer." action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Payment</Button>} />
        : <div className="overflow-x-auto"><div className="grid grid-cols-[8rem_5rem_1fr_8rem_8rem_5rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-w-[800px]"><div>Number</div><div>Type</div><div>Bank Account</div><div>Date</div><div className="text-right">Amount</div><div>Status</div></div>
          {payments.map((p) => (
            <div key={p.id} className="grid grid-cols-[8rem_5rem_1fr_8rem_8rem_5rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm hover:bg-accent/5 min-w-[800px]">
              <div className="font-mono text-xs">{p.paymentNumber}</div>
              <div>{p.paymentType === 'RECEIPT' ? <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">Receipt</Badge> : <Badge variant="outline" className="text-[10px] text-red-700 border-red-200 bg-red-50">Payment</Badge>}</div>
              <div className="truncate text-xs">{p.bankAccount?.accountName || '—'}</div>
              <div className="text-xs text-muted-foreground">{formatDate(p.paymentDate)}</div>
              <div className="text-right font-mono text-xs tabular-nums">{formatMoney(p.amount, p.currency)}</div>
              <div><Badge variant="outline" className="text-[10px]">{p.status}</Badge></div>
            </div>
          ))}</div>}
      </CardContent></Card>

      <CreateFormDialog open={showCreate} onOpenChange={setShowCreate} title="Create Payment" description="Record a payment to a vendor or receipt from a customer." apiEndpoint="/api/payments" successMessage="Payment created" onSuccess={() => setTimeout(() => load(), 100)} fields={[
        { key: 'paymentNumber', label: 'Payment Number', type: 'text', required: true, placeholder: 'PAY-001' },
        { key: 'paymentType', label: 'Payment Type', type: 'select', required: true, options: [
          { value: 'RECEIPT', label: 'Receipt (from Customer)' },
          { value: 'PAYMENT', label: 'Payment (to Vendor)' },
        ], defaultValue: 'PAYMENT' },
        { key: 'partyType', label: 'Party Type', type: 'select', required: true, options: [
          { value: 'VENDOR', label: 'Vendor' },
          { value: 'CUSTOMER', label: 'Customer' },
        ], defaultValue: 'VENDOR' },
        { key: 'partyId', label: 'Vendor', type: 'select', required: true, options: vendors.map((v) => ({ value: v.id, label: v.name })), helpText: 'Select the vendor to pay (or switch Party Type to Customer)' },
        { key: 'bankAccountId', label: 'Bank Account', type: 'select', required: true, options: bankAccounts.map((b) => ({ value: b.id, label: b.accountName })) },
        { key: 'amount', label: 'Amount', type: 'number', required: true, placeholder: '5000', helpText: 'Enter amount in base currency' },
        { key: 'paymentDate', label: 'Payment Date', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        { key: 'reference', label: 'Reference (Check #, Transfer Ref)', type: 'text', placeholder: 'CHK-12345' },
        { key: 'notes', label: 'Notes', type: 'text', placeholder: 'Payment for invoice INV-001' },
      ]} />
    </div>
  )
}
