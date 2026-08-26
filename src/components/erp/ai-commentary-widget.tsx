'use client'

import * as React from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

/**
 * Monthly AI Commentary widget — appears on the dashboard.
 * Generates a 2-paragraph executive summary of current month's financials.
 */
export function AICommentaryWidget({ month }: { month?: string }) {
  const [commentary, setCommentary] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const generate = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/monthly-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      })
      const d = await res.json()
      if (d.commentary) {
        setCommentary(d.commentary)
        toast.success('AI commentary generated')
      } else {
        setError(d.ai?.error || 'AI unavailable')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [month])

  return (
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50/30 to-transparent">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-100 text-violet-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">AI Commentary</div>
              <div className="text-[10px] text-muted-foreground">GLM-powered · monthly summary</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={generate}
            disabled={loading}
            className="h-7"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : commentary ? <RefreshCw className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
            <span className="ml-1">{commentary ? 'Regenerate' : 'Generate'}</span>
          </Button>
        </div>

        {error && (
          <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {commentary && (
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {commentary}
          </div>
        )}

        {!commentary && !loading && !error && (
          <div className="text-xs text-muted-foreground italic">
            Click Generate to get a 2-paragraph executive summary of this month's financials, written by AI.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
