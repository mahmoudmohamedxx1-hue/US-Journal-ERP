'use client'

import * as React from 'react'
import { Wallet, Lock, Unlock, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export function FiscalPeriodsView() {
  const [years, setYears] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState<Record<string, boolean>>({})

  const load = React.useCallback(() => {
    setLoading(true)
    fetch('/api/fiscal-periods')
      .then((r) => r.json())
      .then((d) => setYears(d.fiscalYears || []))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const togglePeriod = async (periodId: string, action: 'close' | 'reopen') => {
    setActionLoading((s) => ({ ...s, [periodId]: true }))
    try {
      const res = await fetch('/api/fiscal-periods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId, action }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed')
      toast.success(`Period ${action === 'close' ? 'closed' : 'reopened'}`)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setActionLoading((s) => ({ ...s, [periodId]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">Settings · Fiscal Periods</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Fiscal Periods</h1>
        <p className="text-sm text-muted-foreground">
          Open and close accounting periods. Closed periods reject new journal postings.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        years.map((fy) => (
          <Card key={fy.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    {fy.name}
                  </CardTitle>
                  <CardDescription>
                    {formatDate(fy.startDate)} → {formatDate(fy.endDate)} · {fy.periods.length} periods
                  </CardDescription>
                </div>
                <Badge variant="outline" className={fy.status === 'Closed' ? 'text-muted-foreground' : 'text-emerald-700 border-emerald-200 bg-emerald-50'}>
                  {fy.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {fy.periods.map((p: any) => {
                  const isLoading = actionLoading[p.id]
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center gap-3 rounded-md border p-3',
                        p.status === 'Closed' ? 'bg-muted/30' : 'bg-card',
                      )}
                    >
                      <div className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-md',
                        p.status === 'Closed' ? 'bg-muted text-muted-foreground' : 'bg-accent/10 text-accent',
                      )}>
                        {p.status === 'Closed' ? <Lock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Period {p.periodNumber}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isLoading}
                        onClick={() => togglePeriod(p.id, p.status === 'Closed' ? 'reopen' : 'close')}
                        className="h-7 text-xs"
                      >
                        {isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : p.status === 'Closed' ? (
                          <><Unlock className="mr-1 h-3 w-3" /> Reopen</>
                        ) : (
                          <><Lock className="mr-1 h-3 w-3" /> Close</>
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
