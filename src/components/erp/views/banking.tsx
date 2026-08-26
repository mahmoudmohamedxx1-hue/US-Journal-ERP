'use client'

import * as React from 'react'
import { Landmark, Plus, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard } from '@/components/erp/kpi-card'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'

export function BankingView() {
  const [accounts, setAccounts] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/banking')
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
      .finally(() => setLoading(false))
  }, [])

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Cash & Banking</span>
            <span>·</span>
            <span>{accounts.length} accounts</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Cash & Banking</h1>
          <p className="text-sm text-muted-foreground">
            Bank account balances and recent transactions. Reconciliation status per transaction.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Account
        </Button>
      </div>

      <KpiCard label="Total Cash Position" value={formatMoney(totalBalance)} hint="across all accounts" icon={<Landmark className="h-4 w-4" />} variant="accent" />

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {accounts.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{a.accountName}</CardTitle>
                    <CardDescription>
                      {a.bankName} · <span className="font-mono">{a.accountNumber}</span>
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">{a.accountType}</Badge>
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                  {formatMoney(a.balance)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Recent Transactions
                </div>
                {a.transactions?.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-4 text-center">No transactions yet</div>
                ) : (
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {a.transactions?.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent/5">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full ${t.type === 'Credit' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {t.type === 'Credit' ? <ArrowDownCircle className="h-3 w-3" /> : <ArrowUpCircle className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{t.description || '—'}</div>
                          <div className="text-[10px] text-muted-foreground">{formatDate(t.date)} {t.reference && `· ${t.reference}`}</div>
                        </div>
                        <div className={`font-mono text-xs font-medium tabular-nums ${t.type === 'Credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {t.type === 'Credit' ? '+' : '−'}{formatMoney(t.amount)}
                        </div>
                        {t.reconciled ? (
                          <Badge variant="outline" className="text-[9px] text-emerald-700 border-emerald-200 bg-emerald-50">Reconciled</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-muted-foreground">Unreconciled</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <CreateFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title="Create New Bank Account"
        description="Add a bank or cash account to track balances and transactions."
        apiEndpoint="/api/banking"
        successMessage="Bank account created successfully"
        onSuccess={() => setTimeout(() => load(), 100)}
        fields={[
          { key: 'accountName', label: 'Account Name', type: 'text', required: true, placeholder: 'Operating Checking' },
          { key: 'bankName', label: 'Bank Name', type: 'text', placeholder: 'First National Bank' },
          { key: 'accountNumber', label: 'Account Number', type: 'text', placeholder: '****4521' },
          { key: 'accountType', label: 'Account Type', type: 'select', options: [
            { value: 'Checking', label: 'Checking' },
            { value: 'Savings', label: 'Savings' },
            { value: 'Cash', label: 'Cash' },
          ], defaultValue: 'Checking' },
          { key: 'balance', label: 'Opening Balance (USD)', type: 'number', placeholder: '0.00', helpText: 'Enter amount in USD (e.g. 50000)' },
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
    </div>
  )
}
