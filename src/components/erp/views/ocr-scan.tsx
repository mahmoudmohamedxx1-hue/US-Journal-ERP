'use client'
import * as React from 'react'
import { ScanText, Upload, FileText, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'
import { toast } from 'sonner'

export function OcrScanView() {
  const [scans, setScans] = React.useState<Array<{id:string;fileName:string;status:string;extractedData:string|null;createdAt:string}>>([])
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    fetch('/api/ocr-scan').then(r=>r.json()).then(d => setScans(d.ocrScans||[])).finally(() => setLoading(false))
  }, [])
  React.useEffect(() => { load() }, [load])

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        const res = await fetch('/api/ocr-scan', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileData: base64 }) })
        const d = await res.json()
        if (d.ocrScan?.status === 'Processed') toast.success(`OCR processed: ${d.ocrScan.extractedData?.slice(0,100) || 'data extracted'}…`)
        else if (d.ocrScan?.status === 'Failed') toast.warning('OCR failed — saved for manual review')
        else toast.success('Scan uploaded')
        load()
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (e) { toast.error('Upload failed'); setUploading(false) }
  }

  return (
    <div className="space-y-6">
      <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Automation</span><span>·</span><span>{scans.length} scans</span></div>
      <h1 className="text-2xl font-semibold tracking-tight">OCR Document Capture</h1>
      <p className="text-sm text-muted-foreground">Upload invoice/bill images to auto-extract data using AI vision.</p></div>
      <Card><CardContent className="p-6">
        <label className="cursor-pointer">
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} disabled={uploading} />
          <Button variant="outline" disabled={uploading} asChild><span>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} {uploading ? 'Processing with AI…' : 'Upload Invoice/Bill Image'}</span></Button>
        </label>
        <p className="mt-2 text-xs text-muted-foreground">Supports PNG, JPG, PDF. Uses Z.AI vision API to extract vendor, amount, date, and line items automatically.</p>
      </CardContent></Card>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-4"><Skeleton className="h-9 w-full" /></div>
        : scans.length === 0 ? <EmptyState icon={ScanText} title="No scans yet" description="Upload an invoice image to auto-extract data with AI." />
        : <div className="divide-y">{scans.map(s => (<div key={s.id} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent"><FileText className="h-4 w-4" /></div>
          <div className="flex-1 min-w-0"><div className="text-sm font-medium">{s.fileName}</div>
            <div className="text-[11px] text-muted-foreground">{formatDate(s.createdAt)}</div>
            {s.extractedData && <div className="mt-1 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground max-h-24 overflow-y-auto">{s.extractedData.slice(0,500)}</div>}
          </div>
          {s.status === 'Processed' ? <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-2.5 w-2.5 mr-1" />Processed</Badge>
           : s.status === 'Failed' ? <Badge variant="outline" className="text-[10px] text-red-700 border-red-200 bg-red-50"><AlertTriangle className="h-2.5 w-2.5 mr-1" />Failed</Badge>
           : <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50"><Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />Pending</Badge>}
        </div>))}</div>}
      </CardContent></Card>
    </div>
  )
}
