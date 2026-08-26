/**
 * Zod validation schemas for API input validation.
 *
 * These schemas enforce strict input shape at the API boundary —
 * invalid requests are rejected with VALIDATION_ERROR before any
 * business logic runs.
 */
import { z } from 'zod'

/** Email format validation */
export const emailSchema = z.string().email().max(255).transform((s) => s.toLowerCase().trim())

/** Password — minimum 8 characters, max 1000 (prevents DoS) */
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(1000)

/** ISO date string (YYYY-MM-DD) */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)')

/** Money amount in cents (Int, >= 0) */
export const centsSchema = z.number().int().min(0).max(999999999999) // max ~$10 billion in cents

/** Journal line input — exactly one of debit/credit must be positive */
export const journalLineSchema = z.object({
  accountId: z.string().min(1).optional(),
  accountCode: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
  debit: centsSchema.default(0),
  credit: centsSchema.default(0),
}).refine(
  (l) => !(l.debit > 0 && l.credit > 0),
  'Debit and credit cannot both be entered on one line',
).refine(
  (l) => l.debit >= 0 && l.credit >= 0,
  'Amounts must be positive',
)

/** Create journal input */
export const createJournalSchema = z.object({
  journalDate: dateSchema,
  source: z.string().max(50).optional(),
  reference: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  currency: z.string().max(3).optional(),  // override with org's base currency if not provided
  exchangeRate: z.number().min(0).max(100000).default(1.0),
  lines: z.array(journalLineSchema).min(2, 'A journal must contain at least two lines').max(1000, 'Too many lines'),
  submit: z.boolean().default(false),
}).refine(
  (j) => !j.submit || Math.abs(
    j.lines.reduce((s, l) => s + l.debit, 0) -
    j.lines.reduce((s, l) => s + l.credit, 0)
  ) < 1,  // < 1 cent tolerance
  {
    message: 'Journal is not balanced — debits must equal credits before submitting',
    path: ['lines'],
  },
)

/** Setup wizard input */
export const setupSchema = z.object({
  organizationName: z.string().min(1, 'Organization name is required').max(200),
  adminName: z.string().min(1, 'Admin name is required').max(200),
  adminEmail: emailSchema,
  adminPassword: passwordSchema,
})

/** Login input */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(1000),
})

/** Reject action input */
export const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(1000),
})

/** Fiscal period action input */
export const periodActionSchema = z.object({
  periodId: z.string().min(1, 'periodId is required'),
  action: z.enum(['close', 'reopen'], {
    errorMap: () => ({ message: 'action must be "close" or "reopen"' }),
  }),
})

/**
 * Parse + validate input against a schema.
 * Returns { success: true, data } or { success: false, error }.
 */
export function validate<T>(schema: z.ZodSchema<T>, input: unknown):
  | { success: true; data: T }
  | { success: false; error: string; details: z.ZodError['issues'] } {
  const result = schema.safeParse(input)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const firstError = result.error.issues[0]
  return {
    success: false,
    error: firstError?.message || 'Validation failed',
    details: result.error.issues,
  }
}
