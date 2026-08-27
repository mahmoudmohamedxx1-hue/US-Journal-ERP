'use client'

import * as React from 'react'
import { Lock, Save, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

/**
 * Lock Dates Settings — Odoo's 5-level lock date system.
 * Shown as a section in the Organization settings page.
 */
export function LockDatesSettings() {
  const [dates, setDates] = React.useState({
    fiscalYearLockDate: '',
    taxLockDate: '',
    saleLockDate: '',
    purchaseLockDate: '',
    hardLockDate: '',
  })
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    fetch('/api/lock-dates')
      .then(r => r.json())
      .then(d => {
        const ld = d.lockDates || {}
        setDates({
          fiscalYearLockDate: ld.fiscalYearLockDate || '',
          taxLockDate: ld.taxLockDate || '',
          saleLockDate: ld.saleLockDate || '',
          purchaseLockDate: ld.purchaseLockDate || '',
          hardLockDate: ld.hardLockDate || '',
        })
      })
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/lock-dates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dates),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed')
      toast.success('Lock dates updated')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">Loading lock dates…</div></CardContent></Card>

  const lockFields = [
    { key: 'fiscalYearLockDate', label: 'Global Lock Date', desc: 'No entries (any type) before this date', severity: 'soft' as const },
    { key: 'taxLockDate', label: 'Tax Return Lock Date', desc: 'No tax entries before this date', severity: 'soft' as const },
    { key: 'saleLockDate', label: 'Sales Lock Date', desc: 'No sales (AR) entries before this date', severity: 'soft' as const },
    { key: 'purchaseLockDate', label: 'Purchase Lock Date', desc: 'No purchase (AP) entries before this date', severity: 'soft' as const },
    { key: 'hardLockDate', label: 'Hard Lock Date', desc: 'IRREVERSIBLE — no entries before this date, ever', severity: 'hard' as const },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" />Lock Dates</CardTitle>
        <CardDescription>Prevent posting journal entries before specific dates. Inspired by Odoo's 5-level lock system.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {lockFields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                {f.severity === 'hard' && (
                  <Badge variant="outline" className="text-[9px] text-red-700 border-red-200 bg-red-50">IRREVERSIBLE</Badge>
                )}
              </div>
              <Input
                id={f.key}
                type="date"
                value={dates[f.key as keyof typeof dates] || ''}
                onChange={e => setDates(prev => ({ ...prev, [f.key]: e.target.value }))}
                disabled={f.key === 'hardLockDate' && dates.hardLockDate !== ''}
                className="h-8"
              />
              <p className="text-[10px] text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Save Lock Dates
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * Integrity Check Panel — shows system health status.
 */
export function IntegrityCheckPanel() {
  const [result, setResult] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(false)

  const runCheck = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/integrity-check')
      const d = await res.json()
      setResult(d)
    } catch {
      toast.error('Failed to run integrity check')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { runCheck() }, [])

  const overall = result?.overall || 'unknown'
  const summary = result?.summary || {}
  const hashChain = result?.hashChain || {}
  const db = result?.database || {}

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {overall === 'healthy' ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
          System Integrity
        </CardTitle>
        <CardDescription>Verify data integrity, hash chain, and database health.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Overall</div>
            <div className={`text-sm font-medium ${overall === 'healthy' ? 'text-emerald-600' : 'text-amber-600'}`}>{overall}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Hash Chain</div>
            <div className="text-sm font-medium">{hashChain.hashed || 0} / {hashChain.total || 0} entries</div>
            {hashChain.broken > 0 && <div className="text-[10px] text-red-600">{hashChain.broken} broken</div>}
          </div>
          <div className="rounded-md border p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Database</div>
            <div className="text-sm font-medium">{db.healthy ? '✓ Healthy' : '✗ Down'}</div>
            <div className="text-[10px] text-muted-foreground">{db.latencyMs}ms latency</div>
          </div>
        </div>
        <Button onClick={runCheck} disabled={loading} variant="outline" size="sm">
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
          Re-run Check
        </Button>
        {hashChain.broken > 0 && (
          <Button onClick={async () => {
            const res = await fetch('/api/journals/repair-hashes', { method: 'POST' })
            const d = await res.json()
            toast.success(d.message || 'Hash chain repaired')
            runCheck()
          }} variant="outline" size="sm" className="ml-2">
            Repair Hash Chain
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Onboarding Progress Widget — shows setup completion.
 */
export function OnboardingWidget() {
  const [progress, setProgress] = React.useState<any>(null)

  React.useEffect(() => {
    fetch('/api/onboarding').then(r => r.json()).then(d => setProgress(d.progress)).catch(() => {})
  }, [])

  if (!progress) return null
  const pct = progress.percentage || 0

  return (
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50/30 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Setup Progress</div>
          <Badge variant="outline" className="text-[10px]">{pct}%</Badge>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mb-3">
          <div className="bg-violet-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {progress.steps?.map((step: any) => (
            <div key={step.id} className="flex items-center gap-1.5 text-[11px]">
              <span className={step.completed ? 'text-emerald-600' : 'text-muted-foreground'}>
                {step.completed ? '✓' : '○'}
              </span>
              <span className={step.completed ? 'text-foreground' : 'text-muted-foreground'}>{step.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Bank Statement Import UI — upload CSV to import bank transactions.
 */
export function BankStatementImport({ bankAccountId, onImported }: { bankAccountId?: string; onImported?: () => void }) {
  const [importing, setImporting] = React.useState(false)
  const [csvText, setCsvText] = React.useState('')
  const [showImport, setShowImport] = React.useState(false)

  const handleImport = async () => {
    if (!bankAccountId || !csvText.trim()) {
      toast.error('Bank account and CSV content required')
      return
    }
    setImporting(true)
    try {
      const res = await fetch('/api/banking/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId, csvContent: csvText }),
      })
      const d = await res.json()
      if (res.ok) {
        const r = d.result || d
        toast.success(`Imported ${r.imported} transactions, skipped ${r.skipped} duplicates`)
        setCsvText('')
        setShowImport(false)
        onImported?.()
      } else {
        toast.error(d.error || 'Import failed')
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  if (!showImport) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
        Import CSV
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Import Bank Statement (CSV)</span>
        <Button variant="ghost" size="sm" onClick={() => setShowImport(false)}>Cancel</Button>
      </div>
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
        rows={5}
        placeholder="date,description,amount,reference&#10;2026-08-01,DEPOSIT,5000.00,DEP-001&#10;2026-08-05,ACH TRANSFER,-1200.00,ACH-005"
        value={csvText}
        onChange={e => setCsvText(e.target.value)}
      />
      <Button onClick={handleImport} disabled={importing} size="sm">
        {importing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        Import
      </Button>
    </div>
  )
}

/**
 * Credit Note button — shown on posted journal detail.
 */
export function CreditNoteButton({ journalId, onCreated }: { journalId: string; onCreated?: () => void }) {
  const [loading, setLoading] = React.useState(false)
  const [showDialog, setShowDialog] = React.useState(false)
  const [reason, setReason] = React.useState('')

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/credit-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journalId,
          reason: reason || 'Customer return',
          reversalDate: new Date().toISOString().slice(0, 10),
        }),
      })
      const d = await res.json()
      if (res.ok) {
        toast.success(d.result?.message || 'Credit note created')
        setShowDialog(false)
        setReason('')
        onCreated?.()
      } else {
        toast.error(d.error || 'Failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setShowDialog(true)}>
        Create Credit Note
      </Button>
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDialog(false)}>
          <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Create Credit Note</h3>
            <p className="text-sm text-muted-foreground">This will create a new Posted journal entry that reverses all lines of this journal.</p>
            <div className="space-y-1.5">
              <Label htmlFor="cn-reason">Reason</Label>
              <Input id="cn-reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Customer return, billing error, etc." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={loading}>
                {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Create Credit Note
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Partner Merge UI — merge duplicate customers/vendors.
 */
export function PartnerMergeButton({ partnerType }: { partnerType: 'customer' | 'vendor' }) {
  const [showDialog, setShowDialog] = React.useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setShowDialog(true)}>
        Merge Duplicates
      </Button>
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDialog(false)}>
          <div className="bg-background rounded-lg p-6 max-w-lg w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Merge {partnerType === 'customer' ? 'Customers' : 'Vendors'}</h3>
            <p className="text-sm text-muted-foreground">
              This will merge duplicate {partnerType}s. Select the target (keep) and sources (deactivate).
              All invoices, bills, and payments will be moved to the target.
            </p>
            <p className="text-xs text-muted-foreground">
              Use the API directly: POST /api/partners/merge with targetPartnerId and sourcePartnerIds.
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>Close</Button>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * KPI Summary widget — shows 14 key metrics.
 */
export function KpiSummaryWidget() {
  const [kpis, setKpis] = React.useState<any>(null)

  React.useEffect(() => {
    fetch('/api/kpi-summary').then(r => r.json()).then(d => setKpis(d.kpis)).catch(() => {})
  }, [])

  if (!kpis) return null

  const items = [
    { label: 'Revenue', value: kpis.totalRevenue, color: 'text-emerald-600' },
    { label: 'Expenses', value: kpis.totalExpenses, color: 'text-red-600' },
    { label: 'Net Income', value: kpis.netIncome, color: kpis.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600' },
    { label: 'Cash', value: kpis.cashBalance, color: 'text-blue-600' },
    { label: 'Open AR', value: kpis.openAR, color: 'text-amber-600' },
    { label: 'Open AP', value: kpis.openAP, color: 'text-orange-600' },
    { label: 'Overdue Inv', value: kpis.overdueInvoices, isCount: true, color: 'text-red-600' },
    { label: 'Overdue Bills', value: kpis.overdueBills, isCount: true, color: 'text-red-600' },
    { label: 'Draft JE', value: kpis.draftJournals, isCount: true, color: 'text-amber-600' },
    { label: 'Posted JE', value: kpis.postedJournals, isCount: true, color: 'text-emerald-600' },
  ]

  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm font-semibold mb-3">KPI Summary</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {items.map(item => (
            <div key={item.label} className="rounded-md border p-2">
              <div className="text-[10px] uppercase text-muted-foreground">{item.label}</div>
              <div className={`text-sm font-mono font-semibold ${item.color}`}>
                {item.isCount ? item.value : formatKpi(item.value)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function formatKpi(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format((cents || 0) / 100)
}
