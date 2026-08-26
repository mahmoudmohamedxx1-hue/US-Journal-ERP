/**
 * US Journal ERP — Payment Terms Engine
 *
 * Inspired by Odoo's account_payment_term model.
 *
 * Odoo's payment terms support multiple due date lines:
 *   - 30% immediate, 70% in 30 days
 *   - 50% in 15 days, 50% in 45 days
 *   - Net 30, Net 60, etc.
 *
 * Each payment term can have multiple "term lines" that define:
 *   - value: 'percent' | 'fixed' | 'balance'
 *   - value_amount: the percentage or fixed amount
 *   - days: number of days after invoice date
 *   - option: 'day_after_invoice' | 'day_following_month' | 'day_end_following_month'
 */

export interface PaymentTermLine {
  value: 'percent' | 'fixed' | 'balance'
  value_amount: number  // percentage (0-100) or fixed amount in cents
  days: number          // due after N days from invoice date
  option?: 'day_after_invoice' | 'day_following_month' | 'day_end_following_month'
}

export interface PaymentTerm {
  id: string
  name: string
  lines: PaymentTermLine[]
}

export interface DueDateResult {
  date: Date
  amount: number  // in cents
  percentage: number
  label: string
}

/**
 * Calculate due dates for an invoice based on payment terms.
 *
 * @param invoiceDate - date of the invoice
 * @param totalAmount - total invoice amount in cents
 * @param paymentTerm - payment term with lines
 * @returns array of { date, amount, percentage, label }
 */
export function calculateDueDates(
  invoiceDate: Date,
  totalAmount: number,
  paymentTerm: PaymentTerm,
): DueDateResult[] {
  const results: DueDateResult[] = []
  let allocatedAmount = 0

  // Sort lines by days ascending (earliest due first)
  const sortedLines = [...paymentTerm.lines].sort((a, b) => a.days - b.days)

  for (let i = 0; i < sortedLines.length; i++) {
    const line = sortedLines[i]
    const isLast = i === sortedLines.length - 1

    let amount: number
    let percentage: number

    if (line.value === 'percent') {
      percentage = line.value_amount
      amount = Math.round(totalAmount * (line.value_amount / 100))
    } else if (line.value === 'fixed') {
      amount = line.value_amount
      percentage = totalAmount > 0 ? (line.value_amount / totalAmount) * 100 : 0
    } else {
      // balance — remaining amount
      amount = totalAmount - allocatedAmount
      percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0
    }

    // Calculate due date
    const dueDate = new Date(invoiceDate)
    dueDate.setDate(dueDate.getDate() + line.days)

    // Handle special options
    if (line.option === 'day_following_month') {
      dueDate.setMonth(dueDate.getMonth() + 1)
      dueDate.setDate(1)
    } else if (line.option === 'day_end_following_month') {
      dueDate.setMonth(dueDate.getMonth() + 1)
      dueDate.setDate(0) // last day of current month
    }

    results.push({
      date: dueDate,
      amount,
      percentage: Math.round(percentage * 100) / 100,
      label: line.value === 'balance'
        ? `Balance (due in ${line.days} days)`
        : line.value === 'percent'
          ? `${line.value_amount}% (due in ${line.days} days)`
          : `Fixed ${line.value_amount / 100} (due in ${line.days} days)`,
    })

    allocatedAmount += amount
  }

  // If no lines defined, default to Net 30
  if (results.length === 0) {
    const dueDate = new Date(invoiceDate)
    dueDate.setDate(dueDate.getDate() + 30)
    results.push({
      date: dueDate,
      amount: totalAmount,
      percentage: 100,
      label: 'Net 30',
    })
  }

  return results
}

/**
 * Get common payment terms presets (like Odoo's default data).
 */
export const PAYMENT_TERM_PRESETS: PaymentTerm[] = [
  {
    id: 'immediate',
    name: 'Immediate Payment',
    lines: [
      { value: 'balance', value_amount: 0, days: 0 },
    ],
  },
  {
    id: 'net15',
    name: 'Net 15',
    lines: [
      { value: 'balance', value_amount: 0, days: 15 },
    ],
  },
  {
    id: 'net30',
    name: 'Net 30',
    lines: [
      { value: 'balance', value_amount: 0, days: 30 },
    ],
  },
  {
    id: 'net45',
    name: 'Net 45',
    lines: [
      { value: 'balance', value_amount: 0, days: 45 },
    ],
  },
  {
    id: 'net60',
    name: 'Net 60',
    lines: [
      { value: 'balance', value_amount: 0, days: 60 },
    ],
  },
  {
    id: '30_70_split',
    name: '30% Immediate, 70% in 30 days',
    lines: [
      { value: 'percent', value_amount: 30, days: 0 },
      { value: 'balance', value_amount: 0, days: 30 },
    ],
  },
  {
    id: '50_50_split',
    name: '50% in 15 days, 50% in 45 days',
    lines: [
      { value: 'percent', value_amount: 50, days: 15 },
      { value: 'balance', value_amount: 0, days: 45 },
    ],
  },
  {
    id: 'due_on_receipt',
    name: 'Due on Receipt',
    lines: [
      { value: 'balance', value_amount: 0, days: 0 },
    ],
  },
]

/**
 * Parse a payment terms string like "Net 30" into a PaymentTerm object.
 * Used for backward compatibility with existing customer/vendor records.
 */
export function parsePaymentTermString(terms: string): PaymentTerm {
  const lower = terms.toLowerCase().trim()

  // Check presets first
  for (const preset of PAYMENT_TERM_PRESETS) {
    if (preset.name.toLowerCase() === lower) return preset
  }

  // Parse "Net N" pattern
  const netMatch = lower.match(/net\s+(\d+)/)
  if (netMatch) {
    const days = parseInt(netMatch[1])
    return {
      id: `net${days}`,
      name: terms,
      lines: [{ value: 'balance', value_amount: 0, days }],
    }
  }

  // Parse "Due on receipt" / "Immediate"
  if (lower.includes('receipt') || lower.includes('immediate') || lower.includes('cod')) {
    return PAYMENT_TERM_PRESETS[0]
  }

  // Default: Net 30
  return PAYMENT_TERM_PRESETS[2]
}
