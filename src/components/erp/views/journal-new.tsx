'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Trash2,
  Save,
  Send,
  ArrowLeft,
  GripVertical,
  Loader2,
  Copy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useErpStore } from '@/lib/erp-store'
import { formatMoney } from '@/lib/format'
import { CurrencyInput } from '@/components/erp/currency-input'
import { AccountCombobox, type AccountOption } from '@/components/erp/account-combobox'
import { BalanceIndicator } from '@/components/erp/balance-indicator'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface JournalLineDraft {
  id: string
  accountId: string
  description: string
  debit: number
  credit: number
}

let _lineId = 0
function newLineId() {
  _lineId += 1
  return `line-${Date.now()}-${_lineId}`
}

export function JournalNewView() {
  const { setView } = useErpStore()

  const [accounts, setAccounts] = React.useState<AccountOption[]>([])
  const [journalDate, setJournalDate] = React.useState(new Date().toISOString().slice(0, 10))
  const [source, setSource] = React.useState('Manual')
  const [reference, setReference] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [lines, setLines] = React.useState<JournalLineDraft[]>([
    { id: newLineId(), accountId: '', description: '', debit: 0, credit: 0 },
    { id: newLineId(), accountId: '', description: '', debit: 0, credit: 0 },
  ])
  const [saving, setSaving] = React.useState<'draft' | 'submit' | null>(null)

  React.useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((d) => {
        // Only detail-level accounts (have full code like 1111, not header 1000)
        const detail = (d.accounts || []).filter((a: { subType: string | null }) => a.subType !== 'Header')
        setAccounts(detail)
      })
  }, [])

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005
  const hasMinimumLines = lines.filter((l) => l.accountId).length >= 2

  const updateLine = (id: string, patch: Partial<JournalLineDraft>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  const addLine = () => {
    setLines((prev) => [...prev, { id: newLineId(), accountId: '', description: '', debit: 0, credit: 0 }])
  }

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length > 2 ? prev.filter((l) => l.id !== id) : prev))
  }

  const duplicateLine = (id: string) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.id === id)
      if (idx < 0) return prev
      const copy = { ...prev[idx], id: newLineId() }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }

  const handleSave = async (submit: boolean) => {
    if (submit && !isBalanced) {
      toast.error('Journal is not balanced — debits must equal credits')
      return
    }
    if (!hasMinimumLines) {
      toast.error('A journal must contain at least two lines with accounts')
      return
    }
    // Validate each line has either debit or credit (not both, not neither — unless zero)
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (!l.accountId) {
        toast.error(`Line ${i + 1} is missing an account`)
        return
      }
      if (l.debit > 0 && l.credit > 0) {
        toast.error(`Line ${i + 1}: debit and credit cannot both be entered`)
        return
      }
      if (l.debit < 0 || l.credit < 0) {
        toast.error(`Line ${i + 1}: amounts must be positive`)
        return
      }
    }

    setSaving(submit ? 'submit' : 'draft')
    try {
      const res = await fetch('/api/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journalDate,
          source,
          reference: reference || undefined,
          description: description || undefined,
          lines: lines.map((l, i) => ({
            accountId: l.accountId,
            description: l.description || undefined,
            debit: l.debit || 0,
            credit: l.credit || 0,
            lineNumber: i + 1,
          })),
          submit,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save journal')
      toast.success(submit ? 'Journal submitted for approval' : 'Draft journal saved')
      // Open the new journal detail view
      if (d.journal?.id) {
        useErpStore.getState().openJournal(d.journal.id)
      } else {
        setView('journals')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save journal')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setView('journals')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">New Journal Entry</span>
            <span>·</span>
            <span>Draft mode</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Create Journal Entry</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main: header + lines */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header fields */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Header Information</CardTitle>
              <CardDescription>Set the entry&apos;s date, source, and reference.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="journalDate">Journal Date <span className="text-destructive">*</span></Label>
                <Input
                  id="journalDate"
                  type="date"
                  value={journalDate}
                  onChange={(e) => setJournalDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  list="sources"
                />
                <datalist id="sources">
                  <option value="Manual" />
                  <option value="AP" />
                  <option value="AR" />
                  <option value="Payroll" />
                  <option value="Reversal" />
                </datalist>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  placeholder="Invoice #, bill #, check #, etc."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the journal entry…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Lines */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Journal Lines</CardTitle>
                <CardDescription>
                  Add at least two lines. Each line must have an account and either a debit or a credit.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addLine}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Line
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {/* Header row */}
              <div className="grid grid-cols-[1.5rem_1fr_1fr_8rem_8rem_2rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <div></div>
                <div>Account</div>
                <div>Description</div>
                <div className="text-right">Debit</div>
                <div className="text-right">Credit</div>
                <div></div>
              </div>
              {/* Line rows */}
              <div>
                {lines.map((l, i) => (
                  <div
                    key={l.id}
                    className="grid grid-cols-[1.5rem_1fr_1fr_8rem_8rem_2rem] items-center gap-2 border-b border-border/40 px-3 py-2 hover:bg-accent/5"
                  >
                    <div className="flex items-center justify-center text-muted-foreground">
                      <GripVertical className="h-3.5 w-3.5 opacity-50" />
                    </div>
                    <div>
                      <AccountCombobox
                        accounts={accounts}
                        value={l.accountId}
                        onChange={(id) => updateLine(l.id, { accountId: id })}
                        placeholder={`Account #${i + 1}`}
                      />
                    </div>
                    <Input
                      placeholder="Line description…"
                      value={l.description}
                      onChange={(e) => updateLine(l.id, { description: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <CurrencyInput
                      value={l.debit}
                      onValueChange={(v) => updateLine(l.id, { debit: v, credit: v > 0 ? 0 : l.credit })}
                      className="h-8"
                    />
                    <CurrencyInput
                      value={l.credit}
                      onValueChange={(v) => updateLine(l.id, { credit: v, debit: v > 0 ? 0 : l.debit })}
                      className="h-8"
                    />
                    <div className="flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateLine(l.id)} title="Duplicate line">
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 hover:text-destructive"
                        onClick={() => removeLine(l.id)}
                        disabled={lines.length <= 2}
                        title="Remove line"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Totals row */}
              <div className="grid grid-cols-[1.5rem_1fr_1fr_8rem_8rem_2rem] items-center gap-2 border-t-2 bg-muted/30 px-3 py-2 text-sm font-medium">
                <div></div>
                <div className="text-xs uppercase text-muted-foreground">Totals</div>
                <div></div>
                <div className="text-right font-mono tabular-nums">{formatMoney(totalDebit)}</div>
                <div className="text-right font-mono tabular-nums">{formatMoney(totalCredit)}</div>
                <div></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: balance + actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Balance Check</CardTitle>
              <CardDescription>Server recalculates totals on save.</CardDescription>
            </CardHeader>
            <CardContent>
              <BalanceIndicator debit={totalDebit} credit={totalCredit} />
              <div className="mt-3 text-xs text-muted-foreground">
                {!hasMinimumLines && (
                  <div className="rounded-md bg-amber-50 px-2 py-1.5 text-amber-700 border border-amber-200">
                    Add at least 2 lines with accounts.
                  </div>
                )}
                {hasMinimumLines && !isBalanced && (
                  <div className="rounded-md bg-amber-50 px-2 py-1.5 text-amber-700 border border-amber-200">
                    Out of balance — debits must equal credits before submitting.
                  </div>
                )}
                {hasMinimumLines && isBalanced && (
                  <div className="rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-700 border border-emerald-200">
                    Ready to save or submit.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full"
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={saving !== null || !hasMinimumLines}
              >
                {saving === 'draft' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Save as Draft
              </Button>
              <Button
                className="w-full"
                onClick={() => handleSave(true)}
                disabled={saving !== null || !hasMinimumLines || !isBalanced}
              >
                {saving === 'submit' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                Submit for Approval
              </Button>
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => setView('journals')}
                disabled={saving !== null}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Validation Rules</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1.5">
              <div>· Debits must equal credits to submit</div>
              <div>· Each line needs an account</div>
              <div>· Debit and credit cannot both be on one line</div>
              <div>· Amounts must be positive</div>
              <div>· Closed fiscal periods reject posting</div>
              <div>· Posted journals cannot be edited</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
