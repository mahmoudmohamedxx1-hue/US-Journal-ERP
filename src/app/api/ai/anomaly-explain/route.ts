import { NextRequest } from 'next/server'
import { ok, err, getSystemContext } from '@/lib/api'
import { explainAnomaly } from '@/lib/ai/glm'

// POST /api/ai/anomaly-explain
// Body: { type, description, severity, amount?, date? }
// Returns: { explanation: string }
export async function POST(req: NextRequest) {
  try {
    await getSystemContext()
    const body = await req.json().catch(() => ({}))
    if (!body.description) return err('description is required', 422)

    const result = await explainAnomaly({
      type: String(body.type || 'UNKNOWN'),
      description: String(body.description),
      severity: body.severity === 'critical' ? 'critical' : 'warning',
      amount: body.amount ? Number(body.amount) : undefined,
      date: body.date ? String(body.date) : undefined,
    })

    return ok({ ai: result, explanation: result.data || null }, 200)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Failed', 500)
  }
}
