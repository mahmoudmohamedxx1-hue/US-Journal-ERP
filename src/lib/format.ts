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
  'Manager',
  'Employee',
] as const

// ============== Multi-Currency Support ==============

export const SUPPORTED_CURRENCIES = [
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', locale: 'en-US' },
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'en-US' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-US' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR', locale: 'en-US' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', locale: 'en-US' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KWD', locale: 'en-US' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'QAR', locale: 'en-US' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BHD', locale: 'en-US' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR', locale: 'en-US' },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'JOD', locale: 'en-US' },
  { code: 'LBP', name: 'Lebanese Pound', symbol: 'LBP', locale: 'en-US' },
] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code']

/** Get currency metadata (symbol, locale) by code */
export function getCurrencyMeta(code: string = 'EGP') {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) || SUPPORTED_CURRENCIES[0]
}

/** Format a money amount (stored as Int cents) for display in the given currency */
export function formatMoney(amount: number, currency = 'USD'): string {
  const dollars = (amount || 0) / 100
  const meta = getCurrencyMeta(currency)
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(dollars)
  } catch {
    // Fallback if locale/currency not supported
    return `${meta.symbol}${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
}

/** Format a value already in display currency (not cents) */
export function formatDollars(amount: number, currency = 'USD'): string {
  const meta = getCurrencyMeta(currency)
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0)
  } catch {
    return `${meta.symbol}${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
}

export function formatNumber(amount: number, decimals = 2): string {
  const dollars = (amount || 0) / 100
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(dollars)
}

export function formatCompact(amount: number): string {
  const dollars = (amount || 0) / 100
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(dollars)
}

/** Convert a display amount (from form input) to cents (Int) for DB storage */
export function dollarsToCents(dollars: number): number {
  return Math.round((dollars || 0) * 100)
}

/** Convert cents (Int, from DB) to display amount */
export function centsToDollars(cents: number): number {
  return (cents || 0) / 100
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
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
