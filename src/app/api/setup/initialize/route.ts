import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { ok, err } from '@/lib/api'

/**
 * POST /api/setup/initialize
 *
 * First-run setup. Creates the organization, an admin user, and
 * optionally seeds demo data (chart of accounts, vendors, customers,
 * sample journals, fiscal periods, etc.).
 *
 * Body:
 *   {
 *     organizationName: string,
 *     adminName: string,
 *     adminEmail: string,
 *     adminPassword: string,        // 8+ chars
 *     seedDemoData: boolean,        // if true, also seed sample accounts/vendors/etc
 *   }
 *
 * Returns:
 *   { success: true, organization: {...}, adminUser: {...} }
 *   or { error, code }
 *
 * Idempotency: returns 409 if any user already exists.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      organizationName,
      adminName,
      adminEmail,
      adminPassword,
      seedDemoData = false,
    } = body

    // --- Validate inputs ---
    if (!organizationName || !adminName || !adminEmail || !adminPassword) {
      return err(
        'organizationName, adminName, adminEmail, adminPassword are required',
        422,
        undefined,
        'VALIDATION_ERROR',
      )
    }

    if (typeof adminPassword !== 'string' || adminPassword.length < 8) {
      return err(
        'Admin password must be at least 8 characters',
        422,
        undefined,
        'VALIDATION_ERROR',
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(adminEmail)) {
      return err('Admin email is invalid', 422, undefined, 'VALIDATION_ERROR')
    }

    // --- Idempotency check: don't allow re-initialization ---
    const existingUserCount = await db.user.count()
    if (existingUserCount > 0) {
      return err(
        'Database is already initialized — use the login screen instead',
        409,
        undefined,
        'ALREADY_INITIALIZED',
      )
    }

    // --- Create organization ---
    const org = await db.organization.create({
      data: {
        id: 'org-us-journal',
        name: String(organizationName),
        legalName: String(organizationName),
        taxId: null,
        currency: 'USD',
        baseCurrency: 'USD',
      },
    })

    // --- Create admin user with bcrypt-hashed password ---
    const passwordHash = await bcrypt.hash(String(adminPassword), 10)
    const adminUser = await db.user.create({
      data: {
        id: 'u-admin',
        email: String(adminEmail).toLowerCase().trim(),
        name: String(adminName),
        passwordHash,
        role: 'Administrator',
        organizationId: org.id,
        active: true,
      },
    })
    await db.membership.create({
      data: {
        userId: adminUser.id,
        organizationId: org.id,
        role: 'Administrator',
      },
    })

    // --- Optionally seed demo data ---
    let seedSummary: { accounts?: number; vendors?: number; customers?: number; journals?: number; fiscalPeriods?: number } = {}
    if (seedDemoData) {
      // Dynamically import the seed module to reuse its logic
      // We can't call `bun run seed` from inside the API, so we re-implement
      // a minimal seed inline here. For full seed, see scripts/seed.ts.

      // 1. Fiscal year + 12 periods
      const fy2026 = await db.fiscalYear.create({
        data: {
          organizationId: org.id,
          name: 'FY 2026',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'Open',
        },
      })
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
      for (let m = 0; m < 12; m++) {
        const start = new Date(2026, m, 1)
        const end = new Date(2026, m + 1, 0, 23, 59, 59)
        await db.fiscalPeriod.create({
          data: {
            fiscalYearId: fy2026.id,
            name: `${monthNames[m]} 2026`,
            periodNumber: m + 1,
            startDate: start,
            endDate: end,
            status: 'Open',
          },
        })
      }
      seedSummary.fiscalPeriods = 12

      // 2. Chart of accounts (full set from scripts/seed.ts)
      // We import the chart-of-accounts data inline since the seed script
      // is in TypeScript and not directly importable from the API.
      const accounts = await seedChartOfAccounts(org.id)
      seedSummary.accounts = accounts

      // 3. Vendors
      const vendorCount = await seedVendors(org.id)
      seedSummary.vendors = vendorCount

      // 4. Customers
      const customerCount = await seedCustomers(org.id)
      seedSummary.customers = customerCount

      // 5. Bank accounts
      await seedBankAccounts(org.id)

      // 6. Tax codes
      await seedTaxCodes(org.id)

      // 7. Dimensions
      await seedDimensions(org.id)

      // 8. Sample journals (optional — keep it light for first-run)
      // Skip journal entries by default to keep the setup fast.
    }

    return ok({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        currency: org.currency,
      },
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
      },
      seedDemoData,
      seedSummary,
    })
  } catch (e) {
    console.error('[setup/initialize] Error:', e)
    return err(
      e instanceof Error ? e.message : 'Setup failed',
      500,
      undefined,
      'INTERNAL_ERROR',
    )
  }
}

// ============== Helper seed functions ==============

const $ = (dollars: number): number => Math.round(dollars * 100)

async function seedChartOfAccounts(orgId: string): Promise<number> {
  const accounts = [
    { code: '1000', name: 'Assets', type: 'Asset', subType: 'Header', normalBalance: 'Debit', parent: null },
    { code: '1100', name: 'Current Assets', type: 'Asset', subType: 'Current Asset', normalBalance: 'Debit', parent: '1000' },
    { code: '1110', name: 'Cash & Cash Equivalents', type: 'Asset', subType: 'Current Asset', normalBalance: 'Debit', parent: '1100' },
    { code: '1111', name: 'Operating Checking Account', type: 'Asset', subType: 'Current Asset', normalBalance: 'Debit', parent: '1110' },
    { code: '1112', name: 'Payroll Checking Account', type: 'Asset', subType: 'Current Asset', normalBalance: 'Debit', parent: '1110' },
    { code: '1113', name: 'Savings Account', type: 'Asset', subType: 'Current Asset', normalBalance: 'Debit', parent: '1110' },
    { code: '1115', name: 'Petty Cash', type: 'Asset', subType: 'Current Asset', normalBalance: 'Debit', parent: '1110' },
    { code: '1120', name: 'Accounts Receivable', type: 'Asset', subType: 'Current Asset', normalBalance: 'Debit', parent: '1100' },
    { code: '1140', name: 'Inventory - Finished Goods', type: 'Asset', subType: 'Current Asset', normalBalance: 'Debit', parent: '1100' },
    { code: '1150', name: 'Prepaid Expenses', type: 'Asset', subType: 'Current Asset', normalBalance: 'Debit', parent: '1100' },
    { code: '1200', name: 'Fixed Assets', type: 'Asset', subType: 'Header', normalBalance: 'Debit', parent: '1000' },
    { code: '1210', name: 'Land', type: 'Asset', subType: 'Fixed Asset', normalBalance: 'Debit', parent: '1200' },
    { code: '1220', name: 'Buildings', type: 'Asset', subType: 'Fixed Asset', normalBalance: 'Debit', parent: '1200' },
    { code: '1230', name: 'Office Equipment', type: 'Asset', subType: 'Fixed Asset', normalBalance: 'Debit', parent: '1200' },
    { code: '1240', name: 'Computer Hardware', type: 'Asset', subType: 'Fixed Asset', normalBalance: 'Debit', parent: '1200' },
    { code: '2000', name: 'Liabilities', type: 'Liability', subType: 'Header', normalBalance: 'Credit', parent: null },
    { code: '2100', name: 'Current Liabilities', type: 'Liability', subType: 'Current Liability', normalBalance: 'Credit', parent: '2000' },
    { code: '2110', name: 'Accounts Payable', type: 'Liability', subType: 'Current Liability', normalBalance: 'Credit', parent: '2100' },
    { code: '2120', name: 'Accrued Expenses', type: 'Liability', subType: 'Current Liability', normalBalance: 'Credit', parent: '2100' },
    { code: '2130', name: 'Sales Tax Payable', type: 'Liability', subType: 'Current Liability', normalBalance: 'Credit', parent: '2100' },
    { code: '2140', name: 'Payroll Tax Payable', type: 'Liability', subType: 'Current Liability', normalBalance: 'Credit', parent: '2100' },
    { code: '2150', name: 'Wages Payable', type: 'Liability', subType: 'Current Liability', normalBalance: 'Credit', parent: '2100' },
    { code: '2200', name: 'Long-term Liabilities', type: 'Liability', subType: 'Header', normalBalance: 'Credit', parent: '2000' },
    { code: '2210', name: 'Bank Loan - 5 Year', type: 'Liability', subType: 'Long-term Liability', normalBalance: 'Credit', parent: '2200' },
    { code: '3000', name: 'Equity', type: 'Equity', subType: 'Header', normalBalance: 'Credit', parent: null },
    { code: '3100', name: 'Common Stock', type: 'Equity', subType: 'Stock', normalBalance: 'Credit', parent: '3000' },
    { code: '3300', name: 'Retained Earnings', type: 'Equity', subType: 'Retained Earnings', normalBalance: 'Credit', parent: '3000' },
    { code: '4000', name: 'Revenue', type: 'Revenue', subType: 'Operating Revenue', normalBalance: 'Credit', parent: null },
    { code: '4100', name: 'Product Sales', type: 'Revenue', subType: 'Operating Revenue', normalBalance: 'Credit', parent: '4000' },
    { code: '4110', name: 'Consulting Revenue', type: 'Revenue', subType: 'Operating Revenue', normalBalance: 'Credit', parent: '4000' },
    { code: '4120', name: 'Subscription Revenue', type: 'Revenue', subType: 'Operating Revenue', normalBalance: 'Credit', parent: '4000' },
    { code: '4210', name: 'Interest Income', type: 'Revenue', subType: 'Other Income', normalBalance: 'Credit', parent: '4000' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'Expense', subType: 'COGS', normalBalance: 'Debit', parent: null },
    { code: '5100', name: 'Materials Cost', type: 'Expense', subType: 'COGS', normalBalance: 'Debit', parent: '5000' },
    { code: '5200', name: 'Direct Labor', type: 'Expense', subType: 'COGS', normalBalance: 'Debit', parent: '5000' },
    { code: '6000', name: 'Operating Expenses', type: 'Expense', subType: 'Operating Expense', normalBalance: 'Debit', parent: null },
    { code: '6100', name: 'Salaries & Wages', type: 'Expense', subType: 'Operating Expense', normalBalance: 'Debit', parent: '6000' },
    { code: '6110', name: 'Payroll Taxes & Benefits', type: 'Expense', subType: 'Operating Expense', normalBalance: 'Debit', parent: '6000' },
    { code: '6200', name: 'Rent Expense', type: 'Expense', subType: 'Operating Expense', normalBalance: 'Debit', parent: '6000' },
    { code: '6300', name: 'Utilities', type: 'Expense', subType: 'Operating Expense', normalBalance: 'Debit', parent: '6000' },
    { code: '6400', name: 'Office Supplies', type: 'Expense', subType: 'Operating Expense', normalBalance: 'Debit', parent: '6000' },
    { code: '6500', name: 'Marketing & Advertising', type: 'Expense', subType: 'Operating Expense', normalBalance: 'Debit', parent: '6000' },
    { code: '6600', name: 'Professional Fees', type: 'Expense', subType: 'Operating Expense', normalBalance: 'Debit', parent: '6000' },
    { code: '6700', name: 'Insurance', type: 'Expense', subType: 'Operating Expense', normalBalance: 'Debit', parent: '6000' },
    { code: '6800', name: 'Depreciation Expense', type: 'Expense', subType: 'Operating Expense', normalBalance: 'Debit', parent: '6000' },
    { code: '6900', name: 'Travel & Entertainment', type: 'Expense', subType: 'Operating Expense', normalBalance: 'Debit', parent: '6000' },
    { code: '7000', name: 'Other Expenses', type: 'Expense', subType: 'Other Expense', normalBalance: 'Debit', parent: null },
    { code: '7100', name: 'Interest Expense', type: 'Expense', subType: 'Other Expense', normalBalance: 'Debit', parent: '7000' },
    { code: '7300', name: 'Bank Charges', type: 'Expense', subType: 'Other Expense', normalBalance: 'Debit', parent: '7000' },
    { code: '7400', name: 'Income Tax Expense', type: 'Expense', subType: 'Tax', normalBalance: 'Debit', parent: '7000' },
  ]
  const acctByCode: Record<string, string> = {}
  for (const a of accounts) {
    const acct = await db.account.create({
      data: {
        organizationId: orgId,
        code: a.code,
        name: a.name,
        accountType: a.type,
        subType: a.subType,
        normalBalance: a.normalBalance,
        active: true,
      },
    })
    acctByCode[a.code] = acct.id
  }
  // Wire parents
  for (const a of accounts) {
    if (a.parent) {
      await db.account.update({
        where: { id: acctByCode[a.code] },
        data: { parentId: acctByCode[a.parent] },
      })
    }
  }
  return accounts.length
}

async function seedVendors(orgId: string): Promise<number> {
  const vendors = [
    { num: 'V-001', name: 'Acme Office Supplies', contact: 'James Park', email: 'sales@acmeoffice.test', terms: 'Net 30', balance: $(4250.00) },
    { num: 'V-002', name: 'TechRental Co.', contact: 'Anna Brooks', email: 'billing@techrental.test', terms: 'Net 15', balance: $(12750.00) },
    { num: 'V-003', name: 'Metro Power & Light', contact: '—', email: 'support@metropower.test', terms: 'Net 30', balance: $(1820.45) },
    { num: 'V-004', name: 'Pinnacle Insurance', contact: 'Robert Vance', email: 'claims@pinnacle.test', terms: 'Net 60', balance: $(8900.00) },
    { num: 'V-005', name: 'Atlas Logistics', contact: 'Lila Hoffman', email: 'ap@atlaslog.test', terms: 'Net 30', balance: $(5600.00) },
    { num: 'V-006', name: 'Westbrook Consulting', contact: 'Evan Wright', email: 'evan@westbrook.test', terms: 'Net 45', balance: $(18750.00) },
    { num: 'V-007', name: 'CityBank Mortgage', contact: '—', email: 'loans@citybank.test', terms: 'Net 30', balance: $(24500.00) },
  ]
  for (const v of vendors) {
    await db.vendor.create({
      data: {
        organizationId: orgId,
        vendorNumber: v.num,
        name: v.name,
        contactName: v.contact,
        email: v.email,
        paymentTerms: v.terms,
        currency: 'USD',
        balance: v.balance,
      },
    })
  }
  return vendors.length
}

async function seedCustomers(orgId: string): Promise<number> {
  const customers = [
    { num: 'C-001', name: 'Northwind Traders', contact: 'Eric Lin', email: 'ap@northwind.test', terms: 'Net 30', balance: $(28500.00), creditLimit: $(50000) },
    { num: 'C-002', name: 'Contoso Pharmaceuticals', contact: 'Yuki Tan', email: 'finance@contoso.test', terms: 'Net 45', balance: $(47800.00), creditLimit: $(75000) },
    { num: 'C-003', name: 'Fabrikam Industries', contact: 'Maria Soto', email: 'ar@fabrikam.test', terms: 'Net 30', balance: $(12300.00), creditLimit: $(30000) },
    { num: 'C-004', name: 'Tailspin Toys', contact: 'Ben Cho', email: 'billing@tailspin.test', terms: 'Net 15', balance: $(5400.00), creditLimit: $(20000) },
    { num: 'C-005', name: 'Wide World Importers', contact: 'Sara Diaz', email: 'ap@wideworld.test', terms: 'Net 60', balance: $(61200.00), creditLimit: $(100000) },
    { num: 'C-006', name: 'Proseware Ltd.', contact: 'Jin Kim', email: 'finance@proseware.test', terms: 'Net 30', balance: $(8900.00), creditLimit: $(25000) },
  ]
  for (const c of customers) {
    await db.customer.create({
      data: {
        organizationId: orgId,
        customerNumber: c.num,
        name: c.name,
        contactName: c.contact,
        email: c.email,
        paymentTerms: c.terms,
        currency: 'USD',
        balance: c.balance,
        creditLimit: c.creditLimit,
      },
    })
  }
  return customers.length
}

async function seedBankAccounts(orgId: string): Promise<number> {
  const accounts = [
    { name: 'Operating Checking', bankName: 'First National Bank', number: '****4521', type: 'Checking', balance: $(285430.22) },
    { name: 'Payroll Checking', bankName: 'First National Bank', number: '****7832', type: 'Checking', balance: $(48200.00) },
    { name: 'Business Savings', bankName: 'First National Bank', number: '****9102', type: 'Savings', balance: $(450000.00) },
    { name: 'Petty Cash', bankName: '—', number: '—', type: 'Cash', balance: $(850.00) },
  ]
  for (const b of accounts) {
    await db.bankAccount.create({
      data: {
        organizationId: orgId,
        accountName: b.name,
        bankName: b.bankName,
        accountNumber: b.number,
        accountType: b.type,
        currency: 'USD',
        balance: b.balance,
      },
    })
  }
  return accounts.length
}

async function seedTaxCodes(orgId: string): Promise<number> {
  const codes = [
    { code: 'STD', name: 'Standard VAT', rate: 800, jurisdiction: 'State', taxType: 'Sales Tax' },
    { code: 'ZERO', name: 'Zero-rated', rate: 0, jurisdiction: 'State', taxType: 'Sales Tax' },
    { code: 'FED', name: 'Federal Sales', rate: 500, jurisdiction: 'Federal', taxType: 'Sales Tax' },
    { code: 'EXEMPT', name: 'Exempt', rate: 0, jurisdiction: 'Federal', taxType: 'Sales Tax' },
  ]
  for (const t of codes) {
    await db.taxCode.create({
      data: { organizationId: orgId, ...t },
    })
  }
  return codes.length
}

async function seedDimensions(orgId: string): Promise<void> {
  const depts = [['D-100', 'Sales'], ['D-200', 'Engineering'], ['D-300', 'Operations'], ['D-400', 'Finance & Admin'], ['D-500', 'Marketing']]
  for (const [code, name] of depts) {
    await db.department.create({ data: { organizationId: orgId, code, name } })
  }
  const locs = [['L-NY', 'New York HQ'], ['L-SF', 'San Francisco'], ['L-AU', 'Austin']]
  for (const [code, name] of locs) {
    await db.location.create({ data: { organizationId: orgId, code, name } })
  }
  const projs = [['P-ORC', 'Orion Cloud Platform', '2026-01-01', '2026-12-31'], ['P-ERP', 'ERP Modernization', '2026-03-01', '2026-09-30'], ['P-MOB', 'Mobile App Rewrite', '2026-02-01', '2026-08-31']]
  for (const [code, name, s, e] of projs) {
    await db.project.create({
      data: { organizationId: orgId, code, name, startDate: new Date(s as string), endDate: new Date(e as string) },
    })
  }
}
