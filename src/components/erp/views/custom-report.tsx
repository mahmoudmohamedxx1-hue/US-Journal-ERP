'use client'

import * as React from 'react'
import { FileBarChart, Plus, Download, Table } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'
import { exportToExcel, exportToPdf } from '@/lib/export-utils'

interface Account { id: string; code: string; name: string; accountType: string }
interface ReportRow { accountCode: string; accountName: string; debit: number; credit: number; balance: number }

export function CustomReportView() {
  const [accounts, setAccounts] = React.useState<Account[]>([])
  const [selectedAccounts, setSelectedAccounts] = React.useState<Set<string>>(new Set())
  const [from, setFrom] = React.useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10))
  const [to, setTo] = React.useState(new Date().toISOString().slice(0, 10))
  const [reportData, setReportData] = React.useState<ReportRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/accounts').then((r) => r.json()).then((d) => setAccounts(d.accounts || []))
  }, [])

  const runReport = async () => {
    setLoading(true)
    const results: ReportRow[] = []
    const accountIds = selectedAccounts.size > 0 ? Array.from(selectedAccounts) : accounts.map((a) => a.id)
    for (const acctId of accountIds) {
      // Fetch ALL journal lines for this account in the date range (not just pageSize=1)
      const res = await fetch(`/api/journal-lines?accountId=${acctId}&from=${from}&to=${to}&pageSize=10000`)
      const data = await res.json()
      const acct = accounts.find((a) => a.id === acctId)
      if (acct && data.total > 0) {
        // Sum debit/credit across all returned lines
        const lines = data.journalLines || data.lines || []
        let totalDebit = 0
        let totalCredit = 0
        for (const l of lines) {
          totalDebit += Number(l.debit || 0)
          totalCredit += Number(l.credit || 0)
        }
        // Balance: for debit-normal accounts (Asset, Expense), it's Dr - Cr; for credit-normal (Liability, Equity, Revenue), Cr - Dr
        const isDebitNormal = acct.accountType === 'Asset' || acct.accountType === 'Expense'
        const balance = isDebitNormal ? totalDebit - totalCredit : totalCredit - totalDebit
        results.push({
          accountCode: acct.code,
          accountName: acct.name,
          debit: totalDebit,  // keep as cents — formatMoney will divide by 100
          credit: totalCredit,
          balance,
        })
      }
    }
    setReportData(results)
    setLoading(false)
    setLoaded(true)
  }

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Reports</span><span>·</span><span>Custom Report Builder</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Custom Report Builder</h1>
        <p className="text-sm text-muted-foreground">Select accounts and date range to build a custom report.</p></div>
      </div>

      <Card><CardContent className="p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div><label className="text-xs font-medium text-muted-foreground">From Date</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input px-3 text-sm" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">To Date</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input px-3 text-sm" /></div>
          <div className="flex items-end"><Button onClick={runReport} disabled={loading} className="w-full"><Table className="mr-2 h-4 w-4" />{loading ? 'Running…' : 'Run Report'}</Button></div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Select Accounts (leave empty for all)</label>
          <div className="mt-1 max-h-48 overflow-y-auto rounded-md border p-2">
            {accounts.map((a) => (
              <label key={a.id} className="flex items-center gap-2 py-0.5 hover:bg-accent/5 rounded px-1 cursor-pointer">
                <input type="checkbox" checked={selectedAccounts.has(a.id)} onChange={() => toggleAccount(a.id)} className="h-3.5 w-3.5" />
                <span className="font-mono text-xs w-14">{a.code}</span>
                <span className="text-sm truncate">{a.name}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{a.accountType}</span>
              </label>
            ))}
          </div>
        </div>
      </CardContent></Card>

      {loaded && (
        <Card><CardContent className="p-0">
          {reportData.length === 0 ? (
            <EmptyState icon={FileBarChart} title="No data found" description="No transactions found for the selected accounts and date range." />
          ) : (
            <>
              <div className="flex justify-end gap-2 p-3">
                <Button variant="outline" size="sm" onClick={() => exportToExcel(`custom-report-${Date.now()}`, reportData as unknown as Array<Record<string, unknown>>)}><Download className="mr-1.5 h-3.5 w-3.5" />Excel</Button>
                <Button variant="outline" size="sm" onClick={() => exportToPdf(`custom-report-${Date.now()}`, 'Custom Report', reportData as unknown as Array<Record<string, unknown>>, [
                  { key: 'accountCode', label: 'Code' }, { key: 'accountName', label: 'Account' },
                  { key: 'debit', label: 'Debit' }, { key: 'credit', label: 'Credit' }, { key: 'balance', label: 'Balance' },
                ], `${from} to ${to}`)}><Download className="mr-1.5 h-3.5 w-3.5" />PDF</Button>
              </div>
              <div className="overflow-x-auto"><div className="grid grid-cols-[6rem_1fr_8rem_8rem_8rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-w-[700px]"><div>Code</div><div>Account</div><div className="text-right">Debit</div><div className="text-right">Credit</div><div className="text-right">Balance</div></div>
                {reportData.map((r, i) => (
                  <div key={i} className="grid grid-cols-[6rem_1fr_8rem_8rem_8rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm min-w-[700px]">
                    <div className="font-mono text-xs">{r.accountCode}</div>
                    <div className="truncate">{r.accountName}</div>
                    <div className="text-right font-mono text-xs tabular-nums">{formatMoney(r.debit)}</div>
                    <div className="text-right font-mono text-xs tabular-nums">{formatMoney(r.credit)}</div>
                    <div className="text-right font-mono text-xs font-medium tabular-nums">{formatMoney(r.balance)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent></Card>
      )}
    </div>
  )
}
