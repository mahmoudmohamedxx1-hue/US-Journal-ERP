/**
 * US Journal ERP — Partner Model (Odoo-inspired)
 *
 * Odoo uses a single `res.partner` model for customers, vendors, companies,
 * and contacts. Partners can have:
 *   - parent_id: links a contact to its parent company
 *   - type: 'contact' | 'invoice' | 'delivery' | 'other'
 *   - child_ids: contacts belonging to this company
 *   - bank_ids: multiple bank accounts per partner
 *   - category_id: tags for segmentation
 *   - is_company: distinguishes company vs individual contacts
 *
 * This module provides helpers to work with the unified partner model.
 */

import { db } from '@/lib/db'

export type PartnerType = 'contact' | 'invoice' | 'delivery' | 'other'
export type PartnerRole = 'customer' | 'vendor' | 'both' | 'employee' | 'none'

export interface PartnerInfo {
  id: string
  name: string
  type: PartnerType
  parentId: string | null
  isCompany: boolean
  vat: string | null
  email: string | null
  phone: string | null
  website: string | null
  street: string | null
  street2: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
  role: PartnerRole
  customerNumber: string | null
  vendorNumber: string | null
  paymentTerms: string | null
  creditLimit: number
  balance: number
  active: boolean
}

/**
 * Get all contacts for a given company partner.
 * In Odoo, child_ids = partners where parent_id = this partner.
 */
export async function getChildContacts(organizationId: string, parentId: string) {
  // In our current schema, Customer and Vendor are separate models.
  // This is a simplified adapter — in a full Odoo migration, we'd merge them.
  const customers = await db.customer.findMany({
    where: { organizationId, active: true },
    select: {
      id: true,
      customerNumber: true,
      name: true,
      contactName: true,
      email: true,
      phone: true,
      address: true,
      paymentTerms: true,
      creditLimit: true,
      balance: true,
      currency: true,
    },
  })
  const vendors = await db.vendor.findMany({
    where: { organizationId, active: true },
    select: {
      id: true,
      vendorNumber: true,
      name: true,
      contactName: true,
      email: true,
      phone: true,
      address: true,
      paymentTerms: true,
      balance: true,
      currency: true,
    },
  })

  return {
    customers: customers.map(c => ({
      id: c.id,
      number: c.customerNumber,
      name: c.name,
      contactName: c.contactName,
      email: c.email,
      phone: c.phone,
      address: c.address,
      paymentTerms: c.paymentTerms,
      creditLimit: c.creditLimit,
      balance: c.balance,
      currency: c.currency,
      role: 'customer' as const,
    })),
    vendors: vendors.map(v => ({
      id: v.id,
      number: v.vendorNumber,
      name: v.name,
      contactName: v.contactName,
      email: v.email,
      phone: v.phone,
      address: v.address,
      paymentTerms: v.paymentTerms,
      balance: v.balance,
      currency: v.currency,
      role: 'vendor' as const,
    })),
  }
}

/**
 * Search partners by name, email, phone, or reference number.
 * Odoo's _rec_names_search searches across multiple fields.
 */
export async function searchPartners(
  organizationId: string,
  query: string,
  limit = 20,
) {
  const q = query.toLowerCase().trim()
  if (!q) return { customers: [], vendors: [] }

  const [customers, vendors] = await Promise.all([
    db.customer.findMany({
      where: {
        organizationId,
        active: true,
        OR: [
          { name: { contains: query } },
          { customerNumber: { contains: query } },
          { email: { contains: query } },
          { contactName: { contains: query } },
          { phone: { contains: query } },
        ],
      },
      take: limit,
      select: { id: true, customerNumber: true, name: true, email: true, balance: true, currency: true },
    }),
    db.vendor.findMany({
      where: {
        organizationId,
        active: true,
        OR: [
          { name: { contains: query } },
          { vendorNumber: { contains: query } },
          { email: { contains: query } },
          { contactName: { contains: query } },
          { phone: { contains: query } },
        ],
      },
      take: limit,
      select: { id: true, vendorNumber: true, name: true, email: true, balance: true, currency: true },
    }),
  ])

  return {
    customers: customers.map(c => ({ ...c, role: 'customer' as const })),
    vendors: vendors.map(v => ({ ...v, role: 'vendor' as const })),
  }
}

/**
 * Get partner statistics: total balance, overdue count, open invoices/bills.
 */
export async function getPartnerStats(organizationId: string, partnerId: string, role: 'customer' | 'vendor') {
  if (role === 'customer') {
    const customer = await db.customer.findFirst({ where: { id: partnerId, organizationId } })
    if (!customer) return null

    const invoices = await db.invoice.findMany({
      where: { customerId: partnerId, organizationId },
      select: { amount: true, amountPaid: true, dueDate: true, status: true },
    })

    const openInvoices = invoices.filter(i => i.status !== 'Paid')
    const overdueInvoices = openInvoices.filter(i => i.dueDate < new Date())
    const totalOutstanding = openInvoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0)
    const totalOverdue = overdueInvoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0)

    return {
      partnerId,
      role: 'customer' as const,
      name: customer.name,
      balance: customer.balance,
      totalOutstanding,
      totalOverdue,
      openInvoicesCount: openInvoices.length,
      overdueInvoicesCount: overdueInvoices.length,
      totalInvoicesCount: invoices.length,
    }
  } else {
    const vendor = await db.vendor.findFirst({ where: { id: partnerId, organizationId } })
    if (!vendor) return null

    const bills = await db.bill.findMany({
      where: { vendorId: partnerId, organizationId },
      select: { amount: true, amountPaid: true, dueDate: true, status: true },
    })

    const openBills = bills.filter(b => b.status !== 'Paid')
    const overdueBills = openBills.filter(b => b.dueDate < new Date())
    const totalOutstanding = openBills.reduce((s, b) => s + (b.amount - b.amountPaid), 0)
    const totalOverdue = overdueBills.reduce((s, b) => s + (b.amount - b.amountPaid), 0)

    return {
      partnerId,
      role: 'vendor' as const,
      name: vendor.name,
      balance: vendor.balance,
      totalOutstanding,
      totalOverdue,
      openBillsCount: openBills.length,
      overdueBillsCount: overdueBills.length,
      totalBillsCount: bills.length,
    }
  }
}
