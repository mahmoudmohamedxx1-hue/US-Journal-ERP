/** Shared formatting + ERP domain constants used across UI components. */

export const JOURNAL_STATUSES = [
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Posted',
  'Reversed',
] as const

export type JournalStatus = (typeof JOURNAL_STATUSES)[number]

export const STATUS_META: Record<
  JournalStatus,
  { color: string; bg: string; label: string; description: string }
> = {
  Draft:        { color: 'text-slate-600',   bg: 'bg-slate-100',   label: 'Draft',        description: 'Editable, not yet submitted' },
  Submitted:    { color: 'text-blue-700',    bg: 'bg-blue-50',     label: 'Submitted',    description: 'Awaiting review' },
  'Under Review': { color: 'text-amber-700', bg: 'bg-amber-50',   label: 'Under Review', description: 'Being reviewed by an approver' },
  Approved:     { color: 'text-teal-700',    bg: 'bg-teal-50',     label: 'Approved',     description: 'Approved, ready to post' },
  Rejected:     { color: 'text-red-700',     bg: 'bg-red-50',      label: 'Rejected',     description: 'Returned to creator — needs revision' },
  Posted:       { color: 'text-emerald-700', bg: 'bg-emerald-50',  label: 'Posted',       description: 'Posted to the general ledger' },
  Reversed:     { color: 'text-purple-700',  bg: 'bg-purple-50',   label: 'Reversed',      description: 'Reversed by a correcting journal' },
}

export const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ACCOUNT_TYPE_META: Record<AccountType, { label: string; color: string; bg: string }> = {
  Asset:      { label: 'Asset',      color: 'text-blue-700',    bg: 'bg-blue-50' },
  Liability:  { label: 'Liability',  color: 'text-amber-700',   bg: 'bg-amber-50' },
  Equity:     { label: 'Equity',     color: 'text-purple-700',   bg: 'bg-purple-50' },
  Revenue:    { label: 'Revenue',    color: 'text-emerald-700', bg: 'bg-emerald-50' },
  Expense:    { label: 'Expense',    color: 'text-red-700',     bg: 'bg-red-50' },
}

export const ROLES = [
  'Viewer',
  'Accountant',
  'Approver',
  'Controller',
  'Administrator',
  'Auditor',
] as const

export function formatMoney(amount: number, currency = 'USD'): string {
  // Amounts are stored as Int (cents) — convert to dollars for display
  const dollars = (amount || 0) / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars)
}

/**
 * Format a value that's already in DOLLARS (not cents).
 * Use this for form inputs where the user types dollar amounts.
 */
export function formatDollars(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0)
}

export function formatNumber(amount: number, decimals = 2): string {
  // Amounts are stored as Int (cents) — convert to dollars for display
  const dollars = (amount || 0) / 100
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(dollars)
}

export function formatCompact(amount: number): string {
  // Amounts are stored as Int (cents) — convert to dollars for display
  const dollars = (amount || 0) / 100
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(dollars)
}

/** Convert a dollar amount (from form input) to cents (Int) for DB storage */
export function dollarsToCents(dollars: number): number {
  return Math.round((dollars || 0) * 100)
}

/** Convert cents (Int, from DB) to dollars for display */
export function centsToDollars(cents: number): number {
  return (cents || 0) / 100
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}
