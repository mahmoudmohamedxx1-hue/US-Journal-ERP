'use client'

import * as React from 'react'
import { Sparkles, Mic, MicOff, Loader2, Wand2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export interface AIParsedJournal {
  debitAccount: string
  creditAccount: string
  amount: number
  currency?: string
  description: string
  date?: string
  reference?: string
  confidence: 'high' | 'medium' | 'low'
  alternatives?: Array<{ account: string; reason: string }>
}

interface AIJournalPanelProps {
  /** Called when user accepts the AI-parsed journal */
  onApply: (parsed: AIParsedJournal) => void
}

/**
 * AI Assistant Panel — appears on the New Journal Entry page.
 * Three features:
 *   1. Natural-language → journal entry ("Record $500 office supplies...")
 *   2. Voice → transcribe → journal entry
 *   3. GL account suggestion for an arbitrary description
 */
export function AIJournalPanel({ onApply }: AIJournalPanelProps) {
  const [instruction, setInstruction] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<AIParsedJournal | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Voice state
  const [recording, setRecording] = React.useState(false)
  const [voiceLoading, setVoiceLoading] = React.useState(false)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])

  const runNaturalLanguage = async () => {
    if (!instruction.trim()) {
      toast.error('Enter an instruction first')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/ai/nl-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      })
      const d = await res.json()
      if (d.parsed) {
        setResult(d.parsed)
        toast.success(`AI suggested entry: ${d.parsed.debitAccount} / ${d.parsed.creditAccount}`)
      } else {
        setError(d.ai?.error || 'AI could not parse that instruction')
        toast.warning('AI could not parse — try rephrasing')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      toast.error('AI request failed')
    } finally {
      setLoading(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1]
          await submitVoice(base64, 'audio/webm')
          stream.getTracks().forEach(t => t.stop())
        }
        reader.readAsDataURL(blob)
      }
      mr.start()
      setRecording(true)
      toast.info('Recording… click stop when done')
    } catch (e) {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  const submitVoice = async (base64: string, mimeType: string) => {
    setVoiceLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/ai/voice-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType }),
      })
      const d = await res.json()
      if (d.parsed) {
        setResult(d.parsed)
        setInstruction(d.transcript || '')
        toast.success(`Heard: "${(d.transcript || '').slice(0, 60)}…"`)
      } else {
        setError(d.ai?.error || 'Could not parse voice input')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      toast.error('Voice processing failed')
    } finally {
      setVoiceLoading(false)
    }
  }

  const handleApply = () => {
    if (result) {
      onApply(result)
      toast.success('Applied AI suggestion — review and post')
    }
  }

  return (
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50/40 to-transparent">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-100 text-violet-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">AI Assistant</div>
              <div className="text-[10px] text-muted-foreground">Powered by GLM · free tier</div>
            </div>
          </div>
          {result && (
            <Badge variant="outline" className={
              result.confidence === 'high' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' :
              result.confidence === 'medium' ? 'text-amber-700 border-amber-200 bg-amber-50' :
              'text-red-700 border-red-200 bg-red-50'
            }>
              {result.confidence} confidence
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder='e.g. "Record $500 office supplies from Staples paid with Visa"'
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !loading) runNaturalLanguage() }}
            disabled={loading || voiceLoading || recording}
            className="flex-1"
          />
          <Button onClick={runNaturalLanguage} disabled={loading || voiceLoading || recording || !instruction.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          </Button>
          <Button
            variant={recording ? 'destructive' : 'outline'}
            onClick={recording ? stopRecording : startRecording}
            disabled={loading || voiceLoading}
            title={recording ? 'Stop recording' : 'Voice entry'}
          >
            {recording ? <MicOff className="h-4 w-4" /> : voiceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          </Button>
        </div>

        {error && (
          <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-md border bg-background p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Debit</div>
                <div className="font-mono font-medium">{result.debitAccount}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Credit</div>
                <div className="font-mono font-medium">{result.creditAccount}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Amount</div>
                <div className="font-medium">{result.currency || ''} {result.amount?.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Date</div>
                <div className="font-medium">{result.date || 'today'}</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground italic">"{result.description}"</div>
            {result.alternatives && result.alternatives.length > 0 && (
              <div className="text-[10px] text-muted-foreground">
                <span className="font-semibold">Alternatives:</span>{' '}
                {result.alternatives.map(a => `${a.account} (${a.reason})`).join('; ')}
              </div>
            )}
            <Button size="sm" onClick={handleApply} className="w-full bg-violet-600 hover:bg-violet-700">
              <Wand2 className="mr-1.5 h-3 w-3" /> Apply to Journal Entry
            </Button>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground">
          Press <kbd className="px-1 bg-muted rounded">Enter</kbd> to parse · Click mic for voice entry
        </div>
      </CardContent>
    </Card>
  )
}
