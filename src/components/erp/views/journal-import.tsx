'use client'

import * as React from 'react'
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { parseJournalExcel, downloadJournalTemplate, type ParsedJournal } from '@/lib/excel-import'

export function JournalImportView() {
  const [file, setFile] = React.useState<File | null>(null)
  const [parsing, setParsing] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const [journals, setJournals] = React.useState<ParsedJournal[]>([])
  const [errors, setErrors] = React.useState<string[]>([])
  const [results, setResults] = React.useState<Array<{ number: string; success: boolean; error?: string }>>([])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setParsing(true)
    setErrors([])
    setJournals([])
    setResults([])
    try {
      const { journals: parsed, errors: parseErrors } = await parseJournalExcel(selected)
      setJournals(parsed)
      setErrors(parseErrors)
      if (parseErrors.length === 0 && parsed.length > 0) {
        toast.success(`Parsed ${parsed.length} journal entries from Excel`)
      } else if (parseErrors.length > 0) {
        toast.warning(`Parsed with ${parseErrors.length} errors`)
      }
    } catch (e) {
      toast.error('Failed to parse Excel file')
      setErrors([e instanceof Error ? e.message : 'Parse failed'])
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setResults([])
    const newResults: Array<{ number: string; success: boolean; error?: string }> = []

    for (const journal of journals) {
      try {
        // Convert dollar amounts to cents for the API
        const lines = journal.lines.map((l) => ({
          accountCode: l.accountCode,
          description: l.description,
          debit: Math.round(l.debit * 100),
          credit: Math.round(l.credit * 100),
        }))

        const res = await fetch('/api/journals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            journalDate: journal.journalDate,
            description: journal.description,
            reference: journal.reference,
            source: journal.source || 'Import',
            lines,
            submit: false,
          }),
        })
        const data = await res.json()
        if (res.ok) {
          newResults.push({ number: data.journal?.journalNumber || '?', success: true })
        } else {
          newResults.push({ number: '?', success: false, error: data.error || 'Failed' })
        }
      } catch (e) {
        newResults.push({ number: '?', success: false, error: e instanceof Error ? e.message : 'Failed' })
      }
    }

    setResults(newResults)
    const successCount = newResults.filter((r) => r.success).length
    const failCount = newResults.filter((r) => !r.success).length
    if (failCount === 0) {
      toast.success(`Imported ${successCount} journal entries successfully`)
    } else {
      toast.warning(`Imported ${successCount} entries, ${failCount} failed`)
    }
    setImporting(false)
  }

  const validJournals = journals.filter((j) => j.errors.length === 0)
  const invalidJournals = journals.filter((j) => j.errors.length > 0)
  const successCount = results.filter((r) => r.success).length
  const failCount = results.filter((r) => !r.success).length

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">Import</span>
          <span>·</span>
          <span>Excel Journal Import</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Import Journals from Excel</h1>
        <p className="text-sm text-muted-foreground">
          Upload an Excel file (.xlsx) with journal entries. Download the template for the correct format.
        </p>
      </div>

      {/* Step 1: Download template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Step 1: Download Template
          </CardTitle>
          <CardDescription>Use this template to ensure your data is in the right format.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => downloadJournalTemplate()}>
            <Download className="mr-2 h-4 w-4" />
            Download Excel Template
          </Button>
          <div className="mt-3 text-xs text-muted-foreground">
            <p>Template columns: <strong>Date, Description, Reference, Source, AccountCode, LineDescription, Debit, Credit</strong></p>
            <p className="mt-1">Group rows with the same Date + Description to create multi-line journals. Debits and credits must balance.</p>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Upload file */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Step 2: Upload Excel File
          </CardTitle>
          <CardDescription>Select your completed .xlsx file to parse and preview.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={parsing}
              />
              <Button variant="outline" disabled={parsing} asChild>
                <span>
                  {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {parsing ? 'Parsing…' : file ? file.name : 'Choose File'}
                </span>
              </Button>
            </label>
            {file && !parsing && (
              <span className="text-sm text-muted-foreground">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Preview + validate */}
      {journals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Step 3: Preview & Validate
            </CardTitle>
            <CardDescription>
              {validJournals.length} valid journal(s) ready to import
              {invalidJournals.length > 0 && `, ${invalidJournals.length} with errors`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {errors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-red-800 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  {errors.length} parse error(s)
                </div>
                <ul className="text-xs text-red-700 space-y-0.5 ml-6 list-disc">
                  {errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  {errors.length > 10 && <li>...and {errors.length - 10} more</li>}
                </ul>
              </div>
            )}

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {journals.map((j, i) => (
                <div key={i} className={`rounded-md border p-3 ${j.errors.length > 0 ? 'border-red-200 bg-red-50' : 'border-border'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium">{j.description || '(no description)'}</span>
                      <span className="text-xs text-muted-foreground ml-2">{j.journalDate}</span>
                      {j.reference && <span className="text-xs text-muted-foreground ml-2">Ref: {j.reference}</span>}
                    </div>
                    {j.errors.length > 0 ? (
                      <Badge variant="outline" className="text-[10px] text-red-700 border-red-200 bg-red-50">
                        <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                        {j.errors.length} error(s)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                        {j.lines.length} lines
                      </Badge>
                    )}
                  </div>
                  {j.errors.length > 0 && (
                    <ul className="text-xs text-red-700 mt-1 ml-4 list-disc">
                      {j.errors.map((e, ei) => <li key={ei}>{e}</li>)}
                    </ul>
                  )}
                  {j.errors.length === 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {j.lines.map((l, li) => (
                        <div key={li} className="flex gap-2">
                          <span className="font-mono">{l.accountCode}</span>
                          <span>{l.description || '—'}</span>
                          {l.debit > 0 && <span className="text-emerald-600">Dr ${l.debit.toFixed(2)}</span>}
                          {l.credit > 0 && <span className="text-blue-600">Cr ${l.credit.toFixed(2)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={handleImport}
              disabled={importing || validJournals.length === 0}
              className="w-full"
              size="lg"
            >
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {importing ? 'Importing…' : `Import ${validJournals.length} Journal(s)`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Import Results
            </CardTitle>
            <CardDescription>
              {successCount} succeeded, {failCount} failed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {r.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-mono text-xs">{r.number}</span>
                  <span className={r.success ? 'text-emerald-700' : 'text-red-700'}>
                    {r.success ? 'Imported' : r.error || 'Failed'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
