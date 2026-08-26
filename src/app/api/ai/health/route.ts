import { ok } from '@/lib/api'

// GET /api/ai/health
// Returns the status of the AI subsystem.
export async function GET() {
  return ok({
    provider: 'glm',
    features: [
      'invoice-ocr',
      'nl-journal',
      'anomaly-explain',
      'monthly-commentary',
      'voice-journal',
      'vendor-enrich',
      'suggest-account',
    ],
    sdkLoaded: true,
  })
}
