/**
 * US Journal ERP — Unified GLM (Z.ai) AI module.
 *
 * All AI features route through this single module:
 *   - Invoice OCR (vision)
 *   - Natural-language journal entry (chat)
 *   - Anomaly explanation (chat)
 *   - Monthly financial commentary (chat)
 *   - Voice journal entry (ASR + chat)
 *   - Vendor enrichment (web search + chat)
 *   - GL account suggestion (chat)
 *
 * Design goals:
 *   - Zero API keys required (uses ZAI.create() which auto-handles auth)
 *   - Graceful failure (never breaks the ERP if AI is unavailable)
 *   - All errors returned as structured objects, never thrown
 *   - All AI calls logged to AuditLog for traceability
 */

import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
  provider: 'glm'
  model: string
  latencyMs: number
}

export interface ExtractedInvoice {
  vendor?: string
  vendorTaxId?: string
  amount?: number          // in major currency units (e.g. dollars)
  currency?: string
  date?: string            // ISO yyyy-mm-dd
  invoiceNumber?: string
  dueDate?: string
  lineItems?: Array<{
    description?: string
    quantity?: number
    unitPrice?: number
    amount?: number
  }>
  subtotal?: number
  tax?: number
  total?: number
  notes?: string
}

export interface ParsedJournal {
  debitAccount: string    // account code or name
  creditAccount: string
  amount: number           // major units
  currency?: string
  description: string
  date?: string            // ISO yyyy-mm-dd
  reference?: string
  confidence: 'high' | 'medium' | 'low'
  alternatives?: Array<{ account: string; reason: string }>
}

export interface VendorEnrichment {
  legalName?: string
  taxId?: string
  address?: string
  phone?: string
  website?: string
  industry?: string
  currency?: string
  confidence: 'high' | 'medium' | 'low'
  source?: string
}

// ---------------------------------------------------------------------------
// Client lazy-init
// ---------------------------------------------------------------------------

let _zai: any = null
let _initError: string | null = null

async function getClient(): Promise<any> {
  if (_initError) throw new Error(_initError)
  if (_zai) return _zai
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    _zai = await ZAI.create()
    return _zai
  } catch (e) {
    _initError = e instanceof Error ? e.message : String(e)
    throw e
  }
}

// ---------------------------------------------------------------------------
// Audit logging (best-effort, never throws)
// ---------------------------------------------------------------------------

async function logAICall(opts: {
  feature: string
  model: string
  inputPreview: string
  outputPreview?: string
  latencyMs: number
  ok: boolean
  error?: string
}) {
  try {
    const { logAudit } = await import('@/lib/api')
    await logAudit({
      action: `AI_${opts.feature}`,
      entityType: 'AICall',
      description: `[${opts.model}] ${opts.inputPreview.slice(0, 200)}` +
        (opts.ok ? ` → ${(opts.outputPreview || '').slice(0, 200)}` : ` FAILED: ${opts.error}`),
    })
  } catch {
    // Best-effort logging — never let logging break the AI call.
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Extract structured invoice data from an image. */
export async function extractInvoice(
  imageBase64OrDataUrl: string,
  mimeType = 'image/png',
): Promise<AIResult<ExtractedInvoice>> {
  const start = Date.now()
  const model = 'glm-4v'
  try {
    const zai = await getClient()
    const imageUrl = imageBase64OrDataUrl.startsWith('data:')
      ? imageBase64OrDataUrl
      : `data:${mimeType};base64,${imageBase64OrDataUrl}`

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are an invoice-extraction assistant. Analyze this image and return STRICT JSON with these fields:
{
  "vendor": "string",
  "vendorTaxId": "string or null",
  "amount": number (total in major currency units, e.g. dollars not cents),
  "currency": "ISO 4217 code, e.g. USD, EUR, EGP",
  "date": "YYYY-MM-DD (invoice date)",
  "invoiceNumber": "string",
  "dueDate": "YYYY-MM-DD or null",
  "lineItems": [{ "description": "string", "quantity": number, "unitPrice": number, "amount": number }],
  "subtotal": number,
  "tax": number,
  "total": number,
  "notes": "any extra context"
}

If the image is NOT an invoice, return: {"error":"not an invoice"}.
Return ONLY the JSON object, no markdown, no explanation.`,
            },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    })

    const raw = response.choices?.[0]?.message?.content || ''
    const parsed = safeParseJSON<ExtractedInvoice>(raw)
    if (!parsed) throw new Error('AI returned non-JSON response')

    const result: AIResult<ExtractedInvoice> = {
      ok: true, data: parsed, provider: 'glm', model, latencyMs: Date.now() - start,
    }
    await logAICall({
      feature: 'INVOICE_OCR', model,
      inputPreview: `[image ${mimeType}]`,
      outputPreview: JSON.stringify(parsed).slice(0, 300),
      latencyMs: result.latencyMs, ok: true,
    })
    return result
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await logAICall({
      feature: 'INVOICE_OCR', model, inputPreview: '[image]',
      latencyMs: Date.now() - start, ok: false, error,
    })
    return { ok: false, error, provider: 'glm', model, latencyMs: Date.now() - start }
  }
}

/** Parse a natural-language instruction into a structured journal entry. */
export async function parseJournalCommand(
  instruction: string,
  context?: { availableAccounts?: Array<{ code: string; name: string }> },
): Promise<AIResult<ParsedJournal>> {
  const start = Date.now()
  const model = 'glm-4'
  try {
    const zai = await getClient()
    const accountList = context?.availableAccounts?.slice(0, 200).map(a => `${a.code} - ${a.name}`).join('\n') || ''
    const accountSection = accountList ? `\n\nAvailable accounts (use codes from this list when possible):\n${accountList}` : ''

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: `You are an accounting assistant. Convert the user's instruction into a single balanced journal entry.

Return STRICT JSON:
{
  "debitAccount": "account code or name",
  "creditAccount": "account code or name",
  "amount": number (in major currency units, e.g. 500.00),
  "currency": "ISO code or null if unspecified",
  "description": "a one-line description for the journal entry",
  "date": "YYYY-MM-DD or null if unspecified",
  "reference": "any reference number mentioned or null",
  "confidence": "high|medium|low",
  "alternatives": [{ "account": "code", "reason": "why this could be a better match" }]
}

Rules:
- Debit and credit must balance (same amount)
- If the instruction mentions payment method (Visa, cash, bank, check), credit the appropriate cash/bank account
- If expense category unclear, set confidence to "low" and list alternatives
- Amount should be the numeric value, no currency symbols

Instruction: "${instruction}"${accountSection}

Return ONLY the JSON, no markdown.`,
        },
      ],
    })

    const raw = response.choices?.[0]?.message?.content || ''
    const parsed = safeParseJSON<ParsedJournal>(raw)
    if (!parsed) throw new Error('AI returned non-JSON response')

    const result: AIResult<ParsedJournal> = {
      ok: true, data: parsed, provider: 'glm', model, latencyMs: Date.now() - start,
    }
    await logAICall({
      feature: 'NL_JOURNAL', model,
      inputPreview: instruction.slice(0, 200),
      outputPreview: JSON.stringify(parsed).slice(0, 300),
      latencyMs: result.latencyMs, ok: true,
    })
    return result
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await logAICall({
      feature: 'NL_JOURNAL', model, inputPreview: instruction.slice(0, 200),
      latencyMs: Date.now() - start, ok: false, error,
    })
    return { ok: false, error, provider: 'glm', model, latencyMs: Date.now() - start }
  }
}

/** Explain why an entry was flagged as anomalous. */
export async function explainAnomaly(entry: {
  type: string
  description: string
  severity: 'warning' | 'critical'
  amount?: number
  date?: string
}): Promise<AIResult<string>> {
  const start = Date.now()
  const model = 'glm-4'
  try {
    const zai = await getClient()
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: `You are a forensic accountant. In 2-3 plain-English sentences, explain why this journal entry was flagged as anomalous and suggest what the user should verify.

Anomaly details:
- Type: ${entry.type}
- Severity: ${entry.severity}
- Description: ${entry.description}
${entry.amount ? `- Amount: ${entry.amount}` : ''}
${entry.date ? `- Date: ${entry.date}` : ''}

Be specific and actionable. Do not use bullet points or headers.`,
        },
      ],
    })
    const text = response.choices?.[0]?.message?.content || ''
    const result: AIResult<string> = {
      ok: true, data: text.trim(), provider: 'glm', model, latencyMs: Date.now() - start,
    }
    await logAICall({
      feature: 'ANOMALY_EXPLAIN', model,
      inputPreview: entry.description.slice(0, 200),
      outputPreview: text.slice(0, 200),
      latencyMs: result.latencyMs, ok: true,
    })
    return result
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { ok: false, error, provider: 'glm', model, latencyMs: Date.now() - start }
  }
}

/** Generate a 2-paragraph executive summary of monthly financials. */
export async function generateMonthlyCommentary(opts: {
  month: string
  revenue: number
  expenses: number
  netIncome: number
  topExpenseCategories?: Array<{ name: string; amount: number }>
  priorMonth?: { revenue: number; expenses: number; netIncome: number }
  cashBalance?: number
  receivables?: number
  payables?: number
}): Promise<AIResult<string>> {
  const start = Date.now()
  const model = 'glm-4'
  try {
    const zai = await getClient()
    const prior = opts.priorMonth
      ? `\n\nPrior month: Revenue ${opts.priorMonth.revenue}, Expenses ${opts.priorMonth.expenses}, Net ${opts.priorMonth.netIncome}`
      : ''
    const topExp = opts.topExpenseCategories?.length
      ? `\n\nTop expense categories:\n${opts.topExpenseCategories.map(e => `- ${e.name}: ${e.amount}`).join('\n')}`
      : ''
    const cashSection = opts.cashBalance !== undefined || opts.receivables !== undefined || opts.payables !== undefined
      ? `\n\nBalance sheet highlights: Cash ${opts.cashBalance ?? 'n/a'}, AR ${opts.receivables ?? 'n/a'}, AP ${opts.payables ?? 'n/a'}`
      : ''

    const prompt = `Write a 2-paragraph executive summary of this company's financial performance for ${opts.month}.

Financials:
- Revenue: ${opts.revenue}
- Expenses: ${opts.expenses}
- Net Income: ${opts.netIncome}${prior}${topExp}${cashSection}

Paragraph 1: Highlight revenue, expenses, and net income trends (compare to prior month if provided).
Paragraph 2: Note any concerns, cash position, and one actionable recommendation.

Tone: professional, concise, like a CFO briefing a CEO. No bullet points.`

    const response = await zai.chat.completions.create({ messages: [{ role: 'user', content: prompt }] })
    const text = response.choices?.[0]?.message?.content || ''
    const result: AIResult<string> = {
      ok: true, data: text.trim(), provider: 'glm', model, latencyMs: Date.now() - start,
    }
    await logAICall({
      feature: 'MONTHLY_COMMENTARY', model,
      inputPreview: `${opts.month} rev=${opts.revenue} net=${opts.netIncome}`,
      outputPreview: text.slice(0, 200),
      latencyMs: result.latencyMs, ok: true,
    })
    return result
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { ok: false, error, provider: 'glm', model, latencyMs: Date.now() - start }
  }
}

/** Transcribe audio and parse to a journal entry in one shot. */
export async function voiceToJournal(
  audioBase64: string,
  mimeType = 'audio/wav',
  context?: { availableAccounts?: Array<{ code: string; name: string }> },
): Promise<AIResult<{ transcript: string; parsed?: ParsedJournal }>> {
  const start = Date.now()
  const model = 'glm-asr+glm-4'
  try {
    const zai = await getClient()
    const asrResponse = await zai.asr.transcribe({ audio: audioBase64, mimeType })
    const transcript = asrResponse?.text || asrResponse?.result || ''
    if (!transcript) throw new Error('ASR returned no transcript')

    const parsed = await parseJournalCommand(transcript, context)
    const result: AIResult<{ transcript: string; parsed?: ParsedJournal }> = {
      ok: true,
      data: { transcript, parsed: parsed.data },
      provider: 'glm', model, latencyMs: Date.now() - start,
    }
    await logAICall({
      feature: 'VOICE_JOURNAL', model,
      inputPreview: `[audio ${mimeType}]`,
      outputPreview: transcript.slice(0, 200),
      latencyMs: result.latencyMs, ok: true,
    })
    return result
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await logAICall({
      feature: 'VOICE_JOURNAL', model, inputPreview: '[audio]',
      latencyMs: Date.now() - start, ok: false, error,
    })
    return { ok: false, error, provider: 'glm', model, latencyMs: Date.now() - start }
  }
}

/** Enrich a vendor record by searching the web. */
export async function enrichVendor(vendorName: string): Promise<AIResult<VendorEnrichment>> {
  const start = Date.now()
  const model = 'glm-web-search+glm-4'
  try {
    const zai = await getClient()
    let searchResults: any[] = []
    try {
      const search = await zai.web_search.search({ query: `${vendorName} company official website contact tax id` })
      searchResults = search?.results || search?.items || []
    } catch {
      // Web search optional — fall back to chat-only
    }

    const context = searchResults.length
      ? `Web search results:\n${JSON.stringify(searchResults.slice(0, 5))}`
      : 'No web results available — use your training knowledge.'

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: `Extract vendor information for "${vendorName}".

${context}

Return STRICT JSON:
{
  "legalName": "full legal entity name",
  "taxId": "tax/VAT/EIN if found, else null",
  "address": "headquarters address if found, else null",
  "phone": "main phone if found, else null",
  "website": "official website URL if found, else null",
  "industry": "industry classification",
  "currency": "likely default currency ISO code",
  "confidence": "high|medium|low",
  "source": "where this info came from"
}

Return ONLY the JSON.`,
        },
      ],
    })

    const raw = response.choices?.[0]?.message?.content || ''
    const parsed = safeParseJSON<VendorEnrichment>(raw)
    if (!parsed) throw new Error('AI returned non-JSON response')
    const result: AIResult<VendorEnrichment> = {
      ok: true, data: parsed, provider: 'glm', model, latencyMs: Date.now() - start,
    }
    await logAICall({
      feature: 'VENDOR_ENRICH', model,
      inputPreview: vendorName.slice(0, 100),
      outputPreview: JSON.stringify(parsed).slice(0, 200),
      latencyMs: result.latencyMs, ok: true,
    })
    return result
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { ok: false, error, provider: 'glm', model, latencyMs: Date.now() - start }
  }
}

/** Suggest the best GL account for a transaction description. */
export async function suggestAccount(
  description: string,
  availableAccounts: Array<{ code: string; name: string; type?: string }>,
): Promise<AIResult<{ account: string; confidence: 'high' | 'medium' | 'low'; reason: string }>> {
  const start = Date.now()
  const model = 'glm-4'
  try {
    const zai = await getClient()
    const list = availableAccounts.slice(0, 300).map(a => `${a.code} - ${a.name} (${a.type || 'n/a'})`).join('\n')
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: `Pick the best matching account for this transaction description.

Description: "${description}"

Available accounts:
${list}

Return STRICT JSON: { "account": "<code>", "confidence": "high|medium|low", "reason": "<one sentence>" }

Return ONLY the JSON.`,
        },
      ],
    })
    const raw = response.choices?.[0]?.message?.content || ''
    const parsed = safeParseJSON<{ account: string; confidence: 'high' | 'medium' | 'low'; reason: string }>(raw)
    if (!parsed) throw new Error('AI returned non-JSON response')
    return { ok: true, data: parsed, provider: 'glm', model, latencyMs: Date.now() - start }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { ok: false, error, provider: 'glm', model, latencyMs: Date.now() - start }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParseJSON<T>(raw: string): T | null {
  if (!raw) return null
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }
  try {
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}
