import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { getAnalyticReport, getAnalyticAccounts } from '@/lib/analytic'

// GET /api/analytic/report?from=2026-01-01&to=2026-12-31&dimension=department
export async function GET(req: NextRequest) {
  const ctx = await getSystemContext()
  const url = new URL(req.url)
  const from = new Date(url.searchParams.get('from') || '2026-01-01')
  const to = new Date(url.searchParams.get('to') || '2026-12-31')
  const dimension = (url.searchParams.get('dimension') || 'department') as 'department' | 'project' | 'location'

  const report = await getAnalyticReport(ctx.organizationId, from, to, dimension)
  const accounts = await getAnalyticAccounts(ctx.organizationId)

  return ok({ dimension, from: from.toISOString(), to: to.toISOString(), report, availableAccounts: accounts })
}
