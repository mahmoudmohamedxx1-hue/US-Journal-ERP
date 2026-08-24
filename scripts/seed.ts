/**
 * US Journal ERP — DEV-ONLY Seed Script
 *
 * ⚠️  This script is for DEVELOPMENT AND TESTING ONLY.
 * ⚠️  It is NOT used by the production desktop app.
 *
 * The production app uses the First-run Setup Wizard (see
 * src/app/api/setup/initialize/route.ts) which creates ONLY:
 *   - 1 organization (the user's company)
 *   - 1 administrator user (chosen by the user)
 *
 * This seed script populates the database with DEMO data:
 *   - 6 demo users (one per role) with known passwords
 *   - 66 chart of accounts (sample structure)
 *   - 7 vendors, 6 customers, 4 bank accounts
 *   - 20 sample journal entries across all workflow statuses
 *   - 12 fiscal periods (FY 2026)
 *
 * Developers can run this to quickly populate a test database:
 *   bun run db:push
 *   bun run seed
 *
 * All monetary values are stored as Int (cents) — decimal-safe, no float drift.
 *
 * Run: `bun run scripts/seed.ts`
 */
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

// Convert dollars to cents (Int) — the database stores all money as Int
function $(dollars: number): number {
  return Math.round(dollars * 100)
}

async function main() {
  console.log('🌱 Seeding US Journal ERP...')

  // 1. Organization
  const org = await db.organization.upsert({
    where: { id: 'org-us-journal' },
    update: {},
    create: {
      id: 'org-us-journal',
      name: 'US Journal Holdings',
      legalName: 'US Journal Holdings, Inc.',
      taxId: 'US-84-29384765',
      currency: 'USD',
      baseCurrency: 'USD',
    },
  })
  console.log(`  ✓ Organization: ${org.name}`)

  // 2. Users with various roles — real bcrypt-hashed passwords
  const users = []
  const userDefs = [
    { id: 'u-admin',   email: 'admin@usjournal.test',    name: 'Sarah Chen',     role: 'Administrator', password: 'Admin@2026' },
    { id: 'u-ctrl',    email: 'controller@usjournal.test', name: 'Marcus Reed',    role: 'Controller',    password: 'Control@2026' },
    { id: 'u-appr',    email: 'approver@usjournal.test',  name: 'Diana Park',     role: 'Approver',      password: 'Approve@2026' },
    { id: 'u-acct',    email: 'accountant@usjournal.test', name: 'Omar Haddad',   role: 'Accountant',    password: 'Accounts@2026' },
    { id: 'u-aud',     email: 'auditor@usjournal.test',   name: 'Linda Vasquez',  role: 'Auditor',       password: 'Audit@2026' },
    { id: 'u-view',    email: 'viewer@usjournal.test',     name: 'Tom Bridges',    role: 'Viewer',         password: 'View@2026' },
  ]
  for (const u of userDefs) {
    const passwordHash = await bcrypt.hash(u.password, 10)
    const user = await db.user.upsert({
      where: { email: u.email },
      update: { role: u.role, organizationId: org.id, passwordHash },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        organizationId: org.id,
        passwordHash,
      },
    })
    users.push(user)
    await db.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: { role: u.role },
      create: { userId: user.id, organizationId: org.id, role: u.role },
    })
  }
  console.log(`  ✓ ${users.length} users seeded (bcrypt-hashed passwords)`)

  // 3. Chart of Accounts — production-style structure
  const accounts = [
    // ASSETS (1xxx)
    { code: '1000', name: 'Assets',                       type: 'Asset',      subType: 'Header',        normalBalance: 'Debit',  parent: null },
    { code: '1100', name: 'Current Assets',               type: 'Asset',      subType: 'Current Asset', normalBalance: 'Debit',  parent: '1000' },
    { code: '1110', name: 'Cash & Cash Equivalents',       type: 'Asset',      subType: 'Current Asset', normalBalance: 'Debit',  parent: '1100' },
    { code: '1111', name: 'Operating Checking Account',   type: 'Asset',      subType: 'Current Asset', normalBalance: 'Debit',  parent: '1110' },
    { code: '1112', name: 'Payroll Checking Account',     type: 'Asset',      subType: 'Current Asset', normalBalance: 'Debit',  parent: '1110' },
    { code: '1113', name: 'Savings Account',              type: 'Asset',      subType: 'Current Asset', normalBalance: 'Debit',  parent: '1110' },
    { code: '1115', name: 'Petty Cash',                   type: 'Asset',      subType: 'Current Asset', normalBalance: 'Debit',  parent: '1110' },
    { code: '1120', name: 'Accounts Receivable',          type: 'Asset',      subType: 'Current Asset', normalBalance: 'Debit',  parent: '1100' },
    { code: '1130', name: 'Allowance for Doubtful Accts', type: 'Asset',      subType: 'Current Asset', normalBalance: 'Credit', parent: '1100' },
    { code: '1140', name: 'Inventory - Finished Goods',   type: 'Asset',      subType: 'Current Asset', normalBalance: 'Debit',  parent: '1100' },
    { code: '1150', name: 'Prepaid Expenses',             type: 'Asset',      subType: 'Current Asset', normalBalance: 'Debit',  parent: '1100' },
    { code: '1160', name: 'Sales Tax Receivable',         type: 'Asset',      subType: 'Current Asset', normalBalance: 'Debit',  parent: '1100' },
    { code: '1200', name: 'Fixed Assets',                 type: 'Asset',      subType: 'Header',        normalBalance: 'Debit',  parent: '1000' },
    { code: '1210', name: 'Land',                         type: 'Asset',      subType: 'Fixed Asset',   normalBalance: 'Debit',  parent: '1200' },
    { code: '1220', name: 'Buildings',                    type: 'Asset',      subType: 'Fixed Asset',   normalBalance: 'Debit',  parent: '1200' },
    { code: '1221', name: 'Accumulated Depreciation - Buildings', type: 'Asset', subType: 'Fixed Asset', normalBalance: 'Credit', parent: '1200' },
    { code: '1230', name: 'Office Equipment',             type: 'Asset',      subType: 'Fixed Asset',   normalBalance: 'Debit',  parent: '1200' },
    { code: '1231', name: 'Accumulated Depreciation - Office Equipment', type: 'Asset', subType: 'Fixed Asset', normalBalance: 'Credit', parent: '1200' },
    { code: '1240', name: 'Computer Hardware',            type: 'Asset',      subType: 'Fixed Asset',   normalBalance: 'Debit',  parent: '1200' },
    { code: '1241', name: 'Accumulated Depreciation - Computer Hardware', type: 'Asset', subType: 'Fixed Asset', normalBalance: 'Credit', parent: '1200' },
    { code: '1300', name: 'Other Assets',                 type: 'Asset',      subType: 'Other Asset',   normalBalance: 'Debit',  parent: '1000' },
    { code: '1310', name: 'Intangible Assets - Software', type: 'Asset',      subType: 'Intangible',    normalBalance: 'Debit',  parent: '1300' },
    { code: '1320', name: 'Deferred Tax Assets',          type: 'Asset',      subType: 'Other Asset',   normalBalance: 'Debit',  parent: '1300' },

    // LIABILITIES (2xxx)
    { code: '2000', name: 'Liabilities',                  type: 'Liability',  subType: 'Header',        normalBalance: 'Credit', parent: null },
    { code: '2100', name: 'Current Liabilities',           type: 'Liability',  subType: 'Current Liability', normalBalance: 'Credit', parent: '2000' },
    { code: '2110', name: 'Accounts Payable',              type: 'Liability',  subType: 'Current Liability', normalBalance: 'Credit', parent: '2100' },
    { code: '2120', name: 'Accrued Expenses',              type: 'Liability',  subType: 'Current Liability', normalBalance: 'Credit', parent: '2100' },
    { code: '2130', name: 'Sales Tax Payable',             type: 'Liability',  subType: 'Current Liability', normalBalance: 'Credit', parent: '2100' },
    { code: '2140', name: 'Payroll Tax Payable',           type: 'Liability',  subType: 'Current Liability', normalBalance: 'Credit', parent: '2100' },
    { code: '2150', name: 'Wages Payable',                 type: 'Liability',  subType: 'Current Liability', normalBalance: 'Credit', parent: '2100' },
    { code: '2160', name: 'Short-term Loans',              type: 'Liability',  subType: 'Current Liability', normalBalance: 'Credit', parent: '2100' },
    { code: '2200', name: 'Long-term Liabilities',         type: 'Liability',  subType: 'Header',        normalBalance: 'Credit', parent: '2000' },
    { code: '2210', name: 'Bank Loan - 5 Year',            type: 'Liability',  subType: 'Long-term Liability', normalBalance: 'Credit', parent: '2200' },
    { code: '2220', name: 'Deferred Tax Liabilities',       type: 'Liability',  subType: 'Long-term Liability', normalBalance: 'Credit', parent: '2200' },

    // EQUITY (3xxx)
    { code: '3000', name: 'Equity',                        type: 'Equity',     subType: 'Header',        normalBalance: 'Credit', parent: null },
    { code: '3100', name: 'Common Stock',                  type: 'Equity',     subType: 'Stock',          normalBalance: 'Credit', parent: '3000' },
    { code: '3200', name: 'Additional Paid-in Capital',    type: 'Equity',     subType: 'Capital',        normalBalance: 'Credit', parent: '3000' },
    { code: '3300', name: 'Retained Earnings',             type: 'Equity',     subType: 'Retained Earnings', normalBalance: 'Credit', parent: '3000' },
    { code: '3400', name: 'Owner Distributions',           type: 'Equity',     subType: 'Distribution',   normalBalance: 'Debit',  parent: '3000' },

    // REVENUE (4xxx)
    { code: '4000', name: 'Revenue',                       type: 'Revenue',    subType: 'Operating Revenue', normalBalance: 'Credit', parent: null },
    { code: '4100', name: 'Product Sales',                 type: 'Revenue',    subType: 'Operating Revenue', normalBalance: 'Credit', parent: '4000' },
    { code: '4110', name: 'Consulting Revenue',            type: 'Revenue',    subType: 'Operating Revenue', normalBalance: 'Credit', parent: '4000' },
    { code: '4120', name: 'Subscription Revenue',          type: 'Revenue',    subType: 'Operating Revenue', normalBalance: 'Credit', parent: '4000' },
    { code: '4200', name: 'Other Income',                  type: 'Revenue',    subType: 'Other Income',   normalBalance: 'Credit', parent: '4000' },
    { code: '4210', name: 'Interest Income',              type: 'Revenue',    subType: 'Other Income',   normalBalance: 'Credit', parent: '4000' },
    { code: '4220', name: 'Foreign Exchange Gain',        type: 'Revenue',    subType: 'Other Income',   normalBalance: 'Credit', parent: '4000' },

    // COST OF GOODS SOLD (5xxx)
    { code: '5000', name: 'Cost of Goods Sold',            type: 'Expense',    subType: 'COGS',          normalBalance: 'Debit',  parent: null },
    { code: '5100', name: 'Materials Cost',                type: 'Expense',    subType: 'COGS',          normalBalance: 'Debit',  parent: '5000' },
    { code: '5200', name: 'Direct Labor',                 type: 'Expense',    subType: 'COGS',          normalBalance: 'Debit',  parent: '5000' },
    { code: '5300', name: 'Manufacturing Overhead',       type: 'Expense',    subType: 'COGS',          normalBalance: 'Debit',  parent: '5000' },

    // OPERATING EXPENSES (6xxx)
    { code: '6000', name: 'Operating Expenses',           type: 'Expense',    subType: 'Operating Expense', normalBalance: 'Debit',  parent: null },
    { code: '6100', name: 'Salaries & Wages',             type: 'Expense',    subType: 'Operating Expense', normalBalance: 'Debit',  parent: '6000' },
    { code: '6110', name: 'Payroll Taxes & Benefits',     type: 'Expense',    subType: 'Operating Expense', normalBalance: 'Debit',  parent: '6000' },
    { code: '6200', name: 'Rent Expense',                 type: 'Expense',    subType: 'Operating Expense', normalBalance: 'Debit',  parent: '6000' },
    { code: '6300', name: 'Utilities',                    type: 'Expense',    subType: 'Operating Expense', normalBalance: 'Debit',  parent: '6000' },
    { code: '6400', name: 'Office Supplies',              type: 'Expense',    subType: 'Operating Expense', normalBalance: 'Debit',  parent: '6000' },
    { code: '6500', name: 'Marketing & Advertising',      type: 'Expense',    subType: 'Operating Expense', normalBalance: 'Debit',  parent: '6000' },
    { code: '6600', name: 'Professional Fees',            type: 'Expense',    subType: 'Operating Expense', normalBalance: 'Debit',  parent: '6000' },
    { code: '6700', name: 'Insurance',                    type: 'Expense',    subType: 'Operating Expense', normalBalance: 'Debit',  parent: '6000' },
    { code: '6800', name: 'Depreciation Expense',         type: 'Expense',    subType: 'Operating Expense', normalBalance: 'Debit',  parent: '6000' },
    { code: '6900', name: 'Travel & Entertainment',       type: 'Expense',    subType: 'Operating Expense', normalBalance: 'Debit',  parent: '6000' },

    // OTHER EXPENSES (7xxx)
    { code: '7000', name: 'Other Expenses',               type: 'Expense',    subType: 'Other Expense', normalBalance: 'Debit',  parent: null },
    { code: '7100', name: 'Interest Expense',             type: 'Expense',    subType: 'Other Expense', normalBalance: 'Debit',  parent: '7000' },
    { code: '7200', name: 'Foreign Exchange Loss',        type: 'Expense',    subType: 'Other Expense', normalBalance: 'Debit',  parent: '7000' },
    { code: '7300', name: 'Bank Charges',                 type: 'Expense',    subType: 'Other Expense', normalBalance: 'Debit',  parent: '7000' },
    { code: '7400', name: 'Income Tax Expense',            type: 'Expense',    subType: 'Tax',            normalBalance: 'Debit',  parent: '7000' },
  ]

  // Track accounts by code to wire parent IDs
  const acctByCode: Record<string, string> = {}
  for (const a of accounts) {
    const acct = await db.account.create({
      data: {
        organizationId: org.id,
        code: a.code,
        name: a.name,
        accountType: a.type,
        subType: a.subType,
        normalBalance: a.normalBalance,
        active: true,
        // parent wired in second pass below
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
  console.log(`  ✓ ${accounts.length} accounts seeded`)

  // 4. Fiscal Year 2026 with 12 monthly periods
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
  const periods: { id: string; periodNumber: number; name: string }[] = []
  for (let m = 0; m < 12; m++) {
    const start = new Date(2026, m, 1)
    const end = new Date(2026, m + 1, 0, 23, 59, 59)
    const p = await db.fiscalPeriod.create({
      data: {
        fiscalYearId: fy2026.id,
        name: `${monthNames[m]} 2026`,
        periodNumber: m + 1,
        startDate: start,
        endDate: end,
        status: m < 7 ? 'Closed' : (m === 7 ? 'Open' : 'Open'),
      },
    })
    periods.push(p)
  }
  console.log(`  ✓ 12 fiscal periods created`)

  // 5. Vendors
  const vendors = [
    { num: 'V-001', name: 'Acme Office Supplies', contact: 'James Park', email: 'sales@acmeoffice.test', terms: 'Net 30', balance: $(4250.00) },
    { num: 'V-002', name: 'TechRental Co.',       contact: 'Anna Brooks', email: 'billing@techrental.test', terms: 'Net 15', balance: $(12750.00) },
    { num: 'V-003', name: 'Metro Power & Light',  contact: '—',           email: 'support@metropower.test', terms: 'Net 30', balance: $(1820.45) },
    { num: 'V-004', name: 'Pinnacle Insurance',   contact: 'Robert Vance', email: 'claims@pinnacle.test',  terms: 'Net 60', balance: $(8900.00) },
    { num: 'V-005', name: 'Atlas Logistics',      contact: 'Lila Hoffman', email: 'ap@atlaslog.test',      terms: 'Net 30', balance: $(5600.00) },
    { num: 'V-006', name: 'Westbrook Consulting', contact: 'Evan Wright',  email: 'evan@westbrook.test',    terms: 'Net 45', balance: $(18750.00) },
    { num: 'V-007', name: 'CityBank Mortgage',    contact: '—',            email: 'loans@citybank.test',    terms: 'Net 30', balance: $(24500.00) },
  ]
  for (const v of vendors) {
    await db.vendor.create({
      data: {
        organizationId: org.id,
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
  console.log(`  ✓ ${vendors.length} vendors seeded`)

  // 6. Customers
  const customers = [
    { num: 'C-001', name: 'Northwind Traders',     contact: 'Eric Lin',    email: 'ap@northwind.test',    terms: 'Net 30', balance: $(28500.00), creditLimit: $(50000) },
    { num: 'C-002', name: 'Contoso Pharmaceuticals', contact: 'Yuki Tan', email: 'finance@contoso.test',  terms: 'Net 45', balance: $(47800.00), creditLimit: $(75000) },
    { num: 'C-003', name: 'Fabrikam Industries',   contact: 'Maria Soto',  email: 'ar@fabrikam.test',      terms: 'Net 30', balance: $(12300.00), creditLimit: $(30000) },
    { num: 'C-004', name: 'Tailspin Toys',         contact: 'Ben Cho',     email: 'billing@tailspin.test', terms: 'Net 15', balance: $(5400.00), creditLimit: $(20000) },
    { num: 'C-005', name: 'Wide World Importers',  contact: 'Sara Diaz',   email: 'ap@wideworld.test',    terms: 'Net 60', balance: $(61200.00), creditLimit: $(100000) },
    { num: 'C-006', name: 'Proseware Ltd.',        contact: 'Jin Kim',     email: 'finance@proseware.test',terms: 'Net 30', balance: $(8900.00), creditLimit: $(25000) },
  ]
  for (const c of customers) {
    await db.customer.create({
      data: {
        organizationId: org.id,
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
  console.log(`  ✓ ${customers.length} customers seeded`)

  // 7. Bank accounts
  const bankAccounts = [
    { name: 'Operating Checking', bankName: 'First National Bank', number: '****4521', type: 'Checking', balance: $(285430.22) },
    { name: 'Payroll Checking',   bankName: 'First National Bank', number: '****7832', type: 'Checking', balance: $(48200.00) },
    { name: 'Business Savings',   bankName: 'First National Bank', number: '****9102', type: 'Savings',  balance: $(450000.00) },
    { name: 'Petty Cash',          bankName: '—',                   number: '—',        type: 'Cash',     balance: $(850.00) },
  ]
  for (const b of bankAccounts) {
    await db.bankAccount.create({
      data: {
        organizationId: org.id,
        accountName: b.name,
        bankName: b.bankName,
        accountNumber: b.number,
        accountType: b.type,
        currency: 'USD',
        balance: b.balance,
      },
    })
  }
  console.log(`  ✓ ${bankAccounts.length} bank accounts seeded`)

  // 8. Tax codes
  const taxCodes = [
    { code: 'STD',  name: 'Standard VAT',   rate: 800,  jurisdiction: 'State', taxType: 'Sales Tax' },     // 8% = 800 bps
    { code: 'ZERO', name: 'Zero-rated',     rate: 0,    jurisdiction: 'State', taxType: 'Sales Tax' },
    { code: 'FED',  name: 'Federal Sales',  rate: 500,  jurisdiction: 'Federal', taxType: 'Sales Tax' },   // 5% = 500 bps
    { code: 'EXEMPT', name: 'Exempt',       rate: 0,    jurisdiction: 'Federal', taxType: 'Sales Tax' },
  ]
  for (const t of taxCodes) {
    await db.taxCode.create({
      data: { organizationId: org.id, ...t },
    })
  }
  console.log(`  ✓ ${taxCodes.length} tax codes seeded`)

  // 9. Departments, Locations, Projects
  const depts = [['D-100', 'Sales'], ['D-200', 'Engineering'], ['D-300', 'Operations'],
                 ['D-400', 'Finance & Admin'], ['D-500', 'Marketing']]
  for (const [code, name] of depts) {
    await db.department.create({ data: { organizationId: org.id, code, name } })
  }
  const locs = [['L-NY', 'New York HQ'], ['L-SF', 'San Francisco'], ['L-AU', 'Austin']]
  for (const [code, name] of locs) {
    await db.location.create({ data: { organizationId: org.id, code, name } })
  }
  const projs = [['P-ORC', 'Orion Cloud Platform', '2026-01-01', '2026-12-31'],
                 ['P-ERP', 'ERP Modernization', '2026-03-01', '2026-09-30'],
                 ['P-MOB', 'Mobile App Rewrite', '2026-02-01', '2026-08-31']]
  for (const [code, name, s, e] of projs) {
    await db.project.create({
      data: { organizationId: org.id, code, name, startDate: new Date(s), endDate: new Date(e) },
    })
  }
  console.log(`  ✓ Dimensions seeded (depts/locations/projects)`)

  // 10. Journal entries — covering all statuses
  const accountant = users[3]
  const approver   = users[2]
  const controller = users[1]

  type JL = { accountCode: string; description?: string; debit?: number; credit?: number }
  const journalsToCreate: Array<{
    number: string; date: string; source: string; reference: string; description: string;
    status: string; lines: JL[]
  }> = [
    // Posted — January opening entries
    {
      number: 'JE-2026-0001', date: '2026-01-02', source: 'Manual', reference: 'CAP-001',
      description: 'Record initial capital contribution from shareholders',
      status: 'Posted',
      lines: [
        { accountCode: '1111', description: 'Cash from shareholders', debit: $(500000) },
        { accountCode: '3100', description: 'Common stock issued',    credit: $(500000) },
      ],
    },
    {
      number: 'JE-2026-0002', date: '2026-01-05', source: 'Manual', reference: 'BANK-001',
      description: 'Bank loan disbursement — 5-year term',
      status: 'Posted',
      lines: [
        { accountCode: '1111', description: 'Loan proceeds',            debit: $(250000) },
        { accountCode: '2210', description: '5-year bank loan payable',  credit: $(250000) },
      ],
    },
    {
      number: 'JE-2026-0003', date: '2026-01-15', source: 'Manual', reference: 'INV-2026-001',
      description: 'Product sale to Northwind Traders — invoice INV-2026-001',
      status: 'Posted',
      lines: [
        { accountCode: '1120', description: 'AR — Northwind Traders', debit: $(28500) },
        { accountCode: '4100', description: 'Product sales revenue',  credit: $(26388.89) },
        { accountCode: '2130', description: 'Sales tax payable (8%)', credit: $(2111.11) },
      ],
    },
    {
      number: 'JE-2026-0004', date: '2026-01-20', source: 'AP', reference: 'BILL-V001',
      description: 'Office supplies purchase — Acme Office Supplies',
      status: 'Posted',
      lines: [
        { accountCode: '6400', description: 'Office supplies',         debit: $(4250) },
        { accountCode: '2110', description: 'AP — Acme Office',         credit: $(4250) },
      ],
    },
    {
      number: 'JE-2026-0005', date: '2026-01-28', source: 'Manual', reference: 'PAY-001',
      description: 'Payroll run — January bi-monthly',
      status: 'Posted',
      lines: [
        { accountCode: '6100', description: 'Salaries & wages',  debit: $(84500) },
        { accountCode: '6110', description: 'Payroll taxes',       debit: $(12800) },
        { accountCode: '2150', description: 'Wages payable',      credit: $(72300) },
        { accountCode: '2140', description: 'Payroll tax payable', credit: $(25000) },
      ],
    },
    {
      number: 'JE-2026-0006', date: '2026-02-05', source: 'Manual', reference: 'RENT-2026',
      description: 'Office rent payment — February 2026',
      status: 'Posted',
      lines: [
        { accountCode: '6200', description: 'Rent expense',      debit: $(12000) },
        { accountCode: '1111', description: 'Check #10452',        credit: $(12000) },
      ],
    },
    {
      number: 'JE-2026-0007', date: '2026-02-15', source: 'AR', reference: 'INV-2026-008',
      description: 'Consulting revenue — Contoso Pharmaceuticals',
      status: 'Posted',
      lines: [
        { accountCode: '1120', description: 'AR — Contoso',          debit: $(47800) },
        { accountCode: '4110', description: 'Consulting revenue',   credit: $(44259.26) },
        { accountCode: '2130', description: 'Sales tax payable',     credit: $(3540.74) },
      ],
    },
    {
      number: 'JE-2026-0008', date: '2026-03-10', source: 'Manual', reference: 'DEP-Q1',
      description: 'Quarterly depreciation — Q1 2026',
      status: 'Posted',
      lines: [
        { accountCode: '6800', description: 'Depreciation expense',         debit: $(8500) },
        { accountCode: '1221', description: 'Accum dep — Buildings',         credit: $(4200) },
        { accountCode: '1231', description: 'Accum dep — Office Equipment',  credit: $(2100) },
        { accountCode: '1241', description: 'Accum dep — Computer Hardware', credit: $(2200) },
      ],
    },
    {
      number: 'JE-2026-0009', date: '2026-04-01', source: 'Manual', reference: 'INT-Q1',
      description: 'Bank interest income — Q1 2026',
      status: 'Posted',
      lines: [
        { accountCode: '1113', description: 'Savings interest',  debit: $(4125.50) },
        { accountCode: '4210', description: 'Interest income',    credit: $(4125.50) },
      ],
    },
    {
      number: 'JE-2026-0010', date: '2026-05-12', source: 'AP', reference: 'BILL-V004',
      description: 'Annual insurance premium — Pinnacle Insurance',
      status: 'Posted',
      lines: [
        { accountCode: '6700', description: 'Insurance premium — annual', debit: $(8900) },
        { accountCode: '2110', description: 'AP — Pinnacle',               credit: $(8900) },
      ],
    },
    {
      number: 'JE-2026-0011', date: '2026-06-20', source: 'AR', reference: 'INV-2026-019',
      description: 'Subscription revenue — Wide World Importers annual plan',
      status: 'Posted',
      lines: [
        { accountCode: '1111', description: 'Cash received',              debit: $(61200) },
        { accountCode: '4120', description: 'Subscription revenue',       credit: $(56666.67) },
        { accountCode: '2130', description: 'Sales tax payable (8%)',     credit: $(4533.33) },
      ],
    },
    {
      number: 'JE-2026-0012', date: '2026-07-15', source: 'AP', reference: 'BILL-V006',
      description: 'Consulting fees — Westbrook Consulting — Q2 review',
      status: 'Posted',
      lines: [
        { accountCode: '6600', description: 'Professional fees',          debit: $(18750) },
        { accountCode: '2110', description: 'AP — Westbrook',              credit: $(18750) },
      ],
    },

    // Recent / current month (August 2026) — mixed statuses
    {
      number: 'JE-2026-0013', date: '2026-08-02', source: 'Manual', reference: 'RENT-AUG',
      description: 'Office rent payment — August 2026',
      status: 'Posted',
      lines: [
        { accountCode: '6200', description: 'Rent expense',  debit: $(12000) },
        { accountCode: '1111', description: 'Check #10782',    credit: $(12000) },
      ],
    },
    {
      number: 'JE-2026-0014', date: '2026-08-05', source: 'AR', reference: 'INV-2026-031',
      description: 'Product sale — Tailspin Toys',
      status: 'Approved',
      lines: [
        { accountCode: '1120', description: 'AR — Tailspin Toys',  debit: $(5400) },
        { accountCode: '4100', description: 'Product sales',         credit: $(5000) },
        { accountCode: '2130', description: 'Sales tax (8%)',        credit: $(400) },
      ],
    },
    {
      number: 'JE-2026-0015', date: '2026-08-10', source: 'AP', reference: 'BILL-V003',
      description: 'Electricity bill — Metro Power & Light — July',
      status: 'Submitted',
      lines: [
        { accountCode: '6300', description: 'Utilities — electricity', debit: $(1820.45) },
        { accountCode: '2110', description: 'AP — Metro Power',           credit: $(1820.45) },
      ],
    },
    {
      number: 'JE-2026-0016', date: '2026-08-12', source: 'Manual', reference: 'INV-AUG-005',
      description: 'Consulting revenue — Proseware Ltd.',
      status: 'Under Review',
      lines: [
        { accountCode: '1120', description: 'AR — Proseware',     debit: $(8900) },
        { accountCode: '4110', description: 'Consulting revenue',  credit: $(8900) },
      ],
    },
    {
      number: 'JE-2026-0017', date: '2026-08-15', source: 'Manual', reference: 'TRV-AUG',
      description: 'Sales team travel — client visit to Wide World Importers',
      status: 'Draft',
      lines: [
        { accountCode: '6900', description: 'Travel — flights & lodging', debit: $(2340) },
        { accountCode: '1115', description: 'Petty cash reimbursement',    credit: $(2340) },
      ],
    },
    {
      number: 'JE-2026-0018', date: '2026-08-18', source: 'AP', reference: 'BILL-V002',
      description: 'Equipment rental — TechRental Co. — August',
      status: 'Draft',
      lines: [
        { accountCode: '6400', description: 'Equipment rental',      debit: $(12750) },
        { accountCode: '2110', description: 'AP — TechRental',         credit: $(12750) },
      ],
    },
    {
      number: 'JE-2026-0019', date: '2026-08-20', source: 'Manual', reference: 'FX-AUG',
      description: 'Foreign exchange loss — EUR/USD revaluation',
      status: 'Rejected',
      lines: [
        { accountCode: '7200', description: 'FX loss',          debit: $(540) },
        { accountCode: '1111', description: 'Operating checking', credit: $(540) },
      ],
    },
    {
      number: 'JE-2026-0020', date: '2026-08-22', source: 'Manual', reference: 'INV-AUG-009',
      description: 'Subscription revenue — Contoso Pharmaceuticals — monthly',
      status: 'Draft',
      lines: [
        { accountCode: '1111', description: 'Cash received',          debit: $(7800) },
        { accountCode: '4120', description: 'Subscription revenue',    credit: $(7800) },
      ],
    },
  ]

  let postedCount = 0
  for (const j of journalsToCreate) {
    // Compute totals from lines (server-side truth)
    const totalDebit = j.lines.reduce((s, l) => s + (l.debit ?? 0), 0)
    const totalCredit = j.lines.reduce((s, l) => s + (l.credit ?? 0), 0)

    // Find fiscal period by month
    const jd = new Date(j.date)
    const period = periods[jd.getMonth()]

    const created = await db.journal.create({
      data: {
        organizationId: org.id,
        journalNumber: j.number,
        journalDate: jd,
        postingDate: j.status === 'Posted' ? jd : null,
        fiscalPeriodId: period?.id,
        source: j.source,
        reference: j.reference,
        description: j.description,
        currency: 'USD',
        exchangeRate: 1.0,
        status: j.status,
        totalDebit,
        totalCredit,
        createdById: accountant.id,
        submittedById: j.status !== 'Draft' ? accountant.id : null,
        submittedAt: j.status !== 'Draft' ? jd : null,
        approvedById: ['Approved', 'Posted'].includes(j.status) ? approver.id : null,
        approvedAt: ['Approved', 'Posted'].includes(j.status) ? jd : null,
        postedById: j.status === 'Posted' ? controller.id : null,
        postedAt: j.status === 'Posted' ? jd : null,
        rejectionReason: j.status === 'Rejected' ? 'Need supporting documentation before approval.' : null,
      },
    })

    // Create lines
    for (let i = 0; i < j.lines.length; i++) {
      const l = j.lines[i]
      const acct = await db.account.findFirst({
        where: { organizationId: org.id, code: l.accountCode },
      })
      if (!acct) {
        console.warn(`  ! Account ${l.accountCode} not found for journal ${j.number}`)
        continue
      }
      await db.journalLine.create({
        data: {
          journalId: created.id,
          lineNumber: i + 1,
          accountId: acct.id,
          description: l.description,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
        },
      })
    }

    // Create approval trail for non-draft journals
    if (j.status !== 'Draft') {
      await db.journalApproval.create({
        data: {
          journalId: created.id,
          action: 'Submitted',
          byUserId: accountant.id,
          at: jd,
          comment: 'Submitted for review.',
        },
      })
    }
    if (['Approved', 'Posted'].includes(j.status)) {
      await db.journalApproval.create({
        data: {
          journalId: created.id,
          action: 'Approved',
          byUserId: approver.id,
          at: jd,
          comment: 'Reviewed and approved.',
        },
      })
    }
    if (j.status === 'Rejected') {
      await db.journalApproval.create({
        data: {
          journalId: created.id,
          action: 'Rejected',
          byUserId: approver.id,
          at: jd,
          comment: 'Need supporting documentation before approval.',
        },
      })
    }
    if (j.status === 'Posted') {
      await db.journalApproval.create({
        data: {
          journalId: created.id,
          action: 'Posted',
          byUserId: controller.id,
          at: jd,
          comment: 'Posted to general ledger.',
        },
      })
      postedCount++

      // Audit log entry for posting
      await db.auditLog.create({
        data: {
          organizationId: org.id,
          userId: controller.id,
          action: 'POST_JOURNAL',
          entityType: 'Journal',
          entityId: created.id,
          description: `Posted journal ${j.number} (${j.description})`,
        },
      })
    }
  }
  console.log(`  ✓ ${journalsToCreate.length} journal entries seeded (${postedCount} posted)`)

  // 11. Open invoices / bills
  const invoicesToCreate = [
    { num: 'INV-2026-001', custCode: 'C-001', date: '2026-01-15', due: '2026-02-14', amount: $(28500), paid: $(28500) },
    { num: 'INV-2026-008', custCode: 'C-002', date: '2026-02-15', due: '2026-03-31', amount: $(47800), paid: $(0) },
    { num: 'INV-2026-019', custCode: 'C-005', date: '2026-06-20', due: '2026-08-19', amount: $(61200), paid: $(0) },
    { num: 'INV-2026-031', custCode: 'C-004', date: '2026-08-05', due: '2026-08-20', amount: $(5400), paid: $(0) },
    { num: 'INV-2026-035', custCode: 'C-006', date: '2026-08-22', due: '2026-09-21', amount: $(8900), paid: $(0) },
  ]
  for (const inv of invoicesToCreate) {
    const cust = await db.customer.findFirst({ where: { organizationId: org.id, customerNumber: inv.custCode } })
    if (!cust) continue
    const invDate = new Date(inv.date)
    const dueDate = new Date(inv.due)
    const today = new Date('2026-08-24')
    const overdue = today > dueDate && inv.paid < inv.amount
    const status = inv.paid >= inv.amount ? 'Paid' : (inv.paid > 0 ? 'Partially Paid' : (overdue ? 'Overdue' : 'Open'))
    await db.invoice.create({
      data: {
        organizationId: org.id,
        customerId: cust.id,
        invoiceNumber: inv.num,
        invoiceDate: invDate,
        dueDate,
        amount: inv.amount,
        amountPaid: inv.paid,
        status,
      },
    })
  }
  console.log(`  ✓ ${invoicesToCreate.length} invoices seeded`)

  const billsToCreate = [
    { num: 'BILL-V001', vCode: 'V-001', date: '2026-01-20', due: '2026-02-19', amount: $(4250), paid: $(4250) },
    { num: 'BILL-V004', vCode: 'V-004', date: '2026-05-12', due: '2026-07-11', amount: $(8900), paid: $(0) },
    { num: 'BILL-V003', vCode: 'V-003', date: '2026-08-10', due: '2026-09-09', amount: $(1820.45), paid: $(0) },
    { num: 'BILL-V002', vCode: 'V-002', date: '2026-08-18', due: '2026-09-02', amount: $(12750), paid: $(0) },
    { num: 'BILL-V006', vCode: 'V-006', date: '2026-07-15', due: '2026-08-29', amount: $(18750), paid: $(0) },
    { num: 'BILL-V007', vCode: 'V-007', date: '2026-08-01', due: '2026-08-31', amount: $(24500), paid: $(0) },
  ]
  for (const b of billsToCreate) {
    const vendor = await db.vendor.findFirst({ where: { organizationId: org.id, vendorNumber: b.vCode } })
    if (!vendor) continue
    const billDate = new Date(b.date)
    const dueDate = new Date(b.due)
    const today = new Date('2026-08-24')
    const overdue = today > dueDate && b.paid < b.amount
    const status = b.paid >= b.amount ? 'Paid' : (b.paid > 0 ? 'Partially Paid' : (overdue ? 'Overdue' : 'Open'))
    await db.bill.create({
      data: {
        organizationId: org.id,
        vendorId: vendor.id,
        billNumber: b.num,
        billDate: billDate,
        dueDate,
        amount: b.amount,
        amountPaid: b.paid,
        status,
      },
    })
  }
  console.log(`  ✓ ${billsToCreate.length} bills seeded`)

  // 12. Audit logs for key events
  await db.auditLog.createMany({
    data: [
      { organizationId: org.id, userId: users[0].id, action: 'CREATE_ORG', entityType: 'Organization', entityId: org.id, description: `Organization ${org.name} created` },
      { organizationId: org.id, userId: users[0].id, action: 'INVITE_USER', entityType: 'User', entityId: users[3].id, description: `Invited Omar Haddad as Accountant` },
      { organizationId: org.id, userId: users[3].id, action: 'CREATE_JOURNAL', entityType: 'Journal', description: 'Created JE-2026-0017 (Draft)' },
      { organizationId: org.id, userId: users[3].id, action: 'SUBMIT_JOURNAL', entityType: 'Journal', description: 'Submitted JE-2026-0015 for approval' },
      { organizationId: org.id, userId: users[2].id, action: 'APPROVE_JOURNAL', entityType: 'Journal', description: 'Approved JE-2026-0014' },
      { organizationId: org.id, userId: users[1].id, action: 'POST_JOURNAL', entityType: 'Journal', description: 'Posted JE-2026-0013 to GL' },
      { organizationId: org.id, userId: users[2].id, action: 'REJECT_JOURNAL', entityType: 'Journal', description: 'Rejected JE-2026-0019 — missing documentation' },
      { organizationId: org.id, userId: users[1].id, action: 'CLOSE_PERIOD', entityType: 'FiscalPeriod', description: 'Closed July 2026 period' },
    ],
  })
  console.log(`  ✓ Audit log entries seeded`)

  console.log('\n=== Seed complete ===')
  console.log('Login emails:')
  for (const u of userDefs) {
    console.log(`  ${u.email.padEnd(35)} ${u.role}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
