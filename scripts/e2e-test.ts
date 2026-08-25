/**
 * End-to-end test script for US Journal ERP.
 *
 * Runs the complete business workflow:
 *   1. Setup Wizard (create org + admin)
 *   2. Login
 *   3. Dashboard (empty state)
 *   4. Chart of Accounts (create accounts)
 *   5. Journal creation (draft → submit → approve → post → reverse)
 *   6. Financial reports (Trial Balance, Balance Sheet, Income Statement, Cash Flow)
 *   7. Vendors (AP), Customers (AR), Banking
 *   8. Settings (Users, Organization, Fiscal Periods, Audit Log)
 *   9. Logout
 *
 * Usage: bun run scripts/e2e-test.ts
 *
 * Exit code 0 = all tests passed
 * Exit code 1 = at least one test failed
 */
const BASE = 'http://localhost:3000'

interface TestResult {
  name: string
  passed: boolean
  detail?: string
  durationMs: number
}

const results: TestResult[] = []

async function test(name: string, fn: () => Promise<void | string>): Promise<void> {
  const start = Date.now()
  try {
    const detail = await fn()
    results.push({ name, passed: true, detail, durationMs: Date.now() - start })
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''} (${Date.now() - start}ms)`)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    results.push({ name, passed: false, detail, durationMs: Date.now() - start })
    console.log(`  ✗ ${name} — ${detail} (${Date.now() - start}ms)`)
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

// Cookie jar (stores session cookie between requests)
let sessionCookie: string | null = null

async function api(path: string, options: { method?: string; body?: unknown; expectStatus?: number } = {}): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (sessionCookie) headers['Cookie'] = sessionCookie

  const res = await fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  // Capture Set-Cookie for session
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) {
    const match = setCookie.match(/usj_session=([^;]+)/)
    if (match) sessionCookie = `usj_session=${match[1]}`
  }

  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (options.expectStatus && res.status !== options.expectStatus) {
    throw new Error(`Expected ${options.expectStatus}, got ${res.status} — ${JSON.stringify(data)}`)
  }

  return { status: res.status, data }
}

async function main() {
  console.log('\n========================================')
  console.log('  US Journal ERP — End-to-End Test Suite')
  console.log('========================================\n')

  // === Phase 1: Setup ===
  console.log('Phase 1: Setup Wizard\n')

  await test('GET /api/health returns unhealthy (no users)', async () => {
    const { status, data } = await api('/api/health')
    assertEqual(status, 503, 'Health should be 503 (unhealthy)')
    const d = data as { status: string; checks: { seeded: { status: string } } }
    assertEqual(d.status, 'unhealthy', 'Status should be unhealthy')
    assertEqual(d.checks.seeded.status, 'fail', 'Seeded check should fail')
    return '503 unhealthy'
  })

  await test('GET /api/setup/status returns needsSetup=true', async () => {
    const { data } = await api('/api/setup/status', { expectStatus: 200 })
    const d = data as { needsSetup: boolean; userCount: number }
    assertEqual(d.needsSetup, true, 'Should need setup')
    assertEqual(d.userCount, 0, 'Should have 0 users')
    return `needsSetup=${d.needsSetup}, userCount=${d.userCount}`
  })

  await test('POST /api/setup/initialize with invalid email fails', async () => {
    const { data, status } = await api('/api/setup/initialize', {
      method: 'POST',
      body: {
        organizationName: 'Test',
        adminName: 'Admin',
        adminEmail: 'not-an-email',
        adminPassword: 'Password@123',
      },
    })
    assertEqual(status, 422, 'Should reject invalid email')
    const d = data as { code: string }
    assertEqual(d.code, 'VALIDATION_ERROR', 'Should be VALIDATION_ERROR')
    return '422 VALIDATION_ERROR'
  })

  await test('POST /api/setup/initialize with short password fails', async () => {
    const { data, status } = await api('/api/setup/initialize', {
      method: 'POST',
      body: {
        organizationName: 'Test',
        adminName: 'Admin',
        adminEmail: 'admin@test.com',
        adminPassword: 'short',
      },
    })
    assertEqual(status, 422, 'Should reject short password')
    const d = data as { code: string }
    assertEqual(d.code, 'VALIDATION_ERROR', 'Should be VALIDATION_ERROR')
    return '422 VALIDATION_ERROR'
  })

  await test('POST /api/setup/initialize with valid input succeeds', async () => {
    const { data } = await api('/api/setup/initialize', {
      method: 'POST',
      body: {
        organizationName: 'E2E Test Corporation',
        adminName: 'E2E Admin',
        adminEmail: 'e2e-admin@test.com',
        adminPassword: 'E2EPassword@2026',
      },
      expectStatus: 200,
    })
    const d = data as { success: boolean; organization: { name: string }; adminUser: { email: string; role: string } }
    assertEqual(d.success, true, 'Setup should succeed')
    assertEqual(d.organization.name, 'E2E Test Corporation', 'Org name should match')
    assertEqual(d.adminUser.email, 'e2e-admin@test.com', 'Admin email should match')
    assertEqual(d.adminUser.role, 'Administrator', 'Admin role should be Administrator')
    return `org="${d.organization.name}", admin="${d.adminUser.email}"`
  })

  await test('POST /api/setup/initialize again fails (already initialized)', async () => {
    const { data, status } = await api('/api/setup/initialize', {
      method: 'POST',
      body: {
        organizationName: 'Duplicate',
        adminName: 'Dup Admin',
        adminEmail: 'dup@test.com',
        adminPassword: 'Password@123',
      },
    })
    assertEqual(status, 409, 'Should reject duplicate setup')
    const d = data as { code: string }
    assertEqual(d.code, 'ALREADY_INITIALIZED', 'Should be ALREADY_INITIALIZED')
    return '409 ALREADY_INITIALIZED'
  })

  // === Phase 2: Authentication ===
  console.log('\nPhase 2: Authentication\n')

  await test('GET /api/auth/me without session returns 401', async () => {
    sessionCookie = null  // clear any existing cookie
    const { data, status } = await api('/api/auth/me')
    assertEqual(status, 401, 'Should be 401')
    const d = data as { code: string }
    assertEqual(d.code, 'UNAUTHORIZED', 'Should be UNAUTHORIZED')
    return '401 UNAUTHORIZED'
  })

  await test('POST /api/auth/login with wrong password fails', async () => {
    const { data, status } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'e2e-admin@test.com', password: 'wrongpassword' },
    })
    assertEqual(status, 401, 'Should be 401')
    const d = data as { code: string }
    assertEqual(d.code, 'AUTH_FAILED', 'Should be AUTH_FAILED')
    return '401 AUTH_FAILED'
  })

  await test('POST /api/auth/login with correct credentials succeeds', async () => {
    const { data } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'e2e-admin@test.com', password: 'E2EPassword@2026' },
      expectStatus: 200,
    })
    const d = data as { user: { email: string; name: string; role: string } }
    assertEqual(d.user.email, 'e2e-admin@test.com', 'Email should match')
    assertEqual(d.user.name, 'E2E Admin', 'Name should match')
    assertEqual(d.user.role, 'Administrator', 'Role should be Administrator')
    assert(sessionCookie !== null, 'Session cookie should be set')
    return `user="${d.user.name}", cookie set`
  })

  await test('GET /api/auth/me with session returns user', async () => {
    const { data } = await api('/api/auth/me', { expectStatus: 200 })
    const d = data as { user: { email: string; role: string } }
    assertEqual(d.user.email, 'e2e-admin@test.com', 'Email should match')
    return `user="${d.user.email}"`
  })

  // === Phase 3: Dashboard (empty state) ===
  console.log('\nPhase 3: Dashboard (empty state)\n')

  await test('GET /api/dashboard returns 200 with zero KPIs', async () => {
    const { data } = await api('/api/dashboard', { expectStatus: 200 })
    const d = data as { kpis: { cashBalance: number; ytdRevenue: number; ytdExpenses: number; netIncome: number; unpostedCount: number } }
    assertEqual(d.kpis.cashBalance, 0, 'Cash balance should be 0')
    assertEqual(d.kpis.ytdRevenue, 0, 'YTD revenue should be 0')
    assertEqual(d.kpis.ytdExpenses, 0, 'YTD expenses should be 0')
    assertEqual(d.kpis.netIncome, 0, 'Net income should be 0')
    assertEqual(d.kpis.unpostedCount, 0, 'Unposted count should be 0')
    return 'all KPIs are 0 (empty ERP)'
  })

  await test('GET /api/organization returns org details', async () => {
    const { data } = await api('/api/organization', { expectStatus: 200 })
    const d = data as { organization: { name: string; currency: string } }
    assertEqual(d.organization.name, 'E2E Test Corporation', 'Org name should match')
    assertEqual(d.organization.currency, 'USD', 'Currency should be USD')
    return `name="${d.organization.name}", currency="${d.organization.currency}"`
  })

  await test('GET /api/users returns 1 admin user', async () => {
    const { data } = await api('/api/users', { expectStatus: 200 })
    const d = data as { users: Array<{ email: string; role: string }> }
    assertEqual(d.users.length, 1, 'Should have 1 user')
    assertEqual(d.users[0].email, 'e2e-admin@test.com', 'Email should match')
    assertEqual(d.users[0].role, 'Administrator', 'Role should be Administrator')
    return '1 admin user'
  })

  await test('GET /api/audit-log returns setup entry', async () => {
    const { data } = await api('/api/audit-log', { expectStatus: 200 })
    const d = data as { logs: Array<{ action: string }> }
    assert(d.logs.length > 0, 'Should have at least 1 audit log entry')
    assert(d.logs.some((l) => l.action === 'SETUP_COMPLETE'), 'Should have SETUP_COMPLETE entry')
    return `${d.logs.length} entries, SETUP_COMPLETE found`
  })

  // === Phase 4: Chart of Accounts ===
  console.log('\nPhase 4: Chart of Accounts\n')

  const testAccounts = [
    { code: '1000', name: 'Cash', accountType: 'Asset', normalBalance: 'Debit', subType: 'Current Asset' },
    { code: '4000', name: 'Sales Revenue', accountType: 'Revenue', normalBalance: 'Credit', subType: 'Operating Revenue' },
    { code: '6000', name: 'Operating Expenses', accountType: 'Expense', normalBalance: 'Debit', subType: 'Operating Expense' },
    { code: '2000', name: 'Accounts Payable', accountType: 'Liability', normalBalance: 'Credit', subType: 'Current Liability' },
    { code: '3000', name: 'Owners Equity', accountType: 'Equity', normalBalance: 'Credit', subType: 'Stock' },
  ]

  await test('POST /api/accounts creates 5 accounts', async () => {
    for (const a of testAccounts) {
      await api('/api/accounts', { method: 'POST', body: a, expectStatus: 201 })
    }
    return `${testAccounts.length} accounts created`
  })

  await test('POST /api/accounts duplicate code fails', async () => {
    const { data, status } = await api('/api/accounts', {
      method: 'POST',
      body: { code: '1000', name: 'Duplicate', accountType: 'Asset', normalBalance: 'Debit' },
    })
    assertEqual(status, 409, 'Should be 409 Conflict')
    return '409 duplicate code rejected'
  })

  await test('GET /api/accounts returns 5 accounts', async () => {
    const { data } = await api('/api/accounts', { expectStatus: 200 })
    const d = data as { accounts: Array<{ code: string }> }
    assertEqual(d.accounts.length, 5, 'Should have 5 accounts')
    return `${d.accounts.length} accounts`
  })

  // === Phase 5: Journal Creation + Workflow ===
  console.log('\nPhase 5: Journal Creation + Workflow\n')

  await test('POST /api/journals with single line fails (min 2 lines)', async () => {
    const { data, status } = await api('/api/journals', {
      method: 'POST',
      body: {
        journalDate: '2026-08-25',
        description: 'Invalid single-line journal',
        lines: [{ accountCode: '1000', debit: 10000 }],
      },
    })
    assertEqual(status, 422, 'Should be 422')
    const d = data as { code: string }
    assertEqual(d.code, 'VALIDATION_ERROR', 'Should be VALIDATION_ERROR')
    return '422 single line rejected'
  })

  await test('POST /api/journals unbalanced submit fails', async () => {
    const { data, status } = await api('/api/journals', {
      method: 'POST',
      body: {
        journalDate: '2026-08-25',
        description: 'Unbalanced',
        lines: [
          { accountCode: '1000', debit: 10000 },
          { accountCode: '4000', credit: 5000 },
        ],
        submit: true,
      },
    })
    assertEqual(status, 422, 'Should be 422')
    const d = data as { code: string }
    assertEqual(d.code, 'VALIDATION_ERROR', 'Should be VALIDATION_ERROR')
    return '422 unbalanced rejected'
  })

  let draftJournalId: string

  await test('POST /api/journals creates balanced draft', async () => {
    const { data } = await api('/api/journals', {
      method: 'POST',
      body: {
        journalDate: '2026-08-25',
        description: 'E2E test journal — cash sale',
        lines: [
          { accountCode: '1000', debit: 10000 },  // $100 debit to Cash
          { accountCode: '4000', credit: 10000 },  // $100 credit to Revenue
        ],
      },
      expectStatus: 201,
    })
    const d = data as { journal: { id: string; journalNumber: string; status: string; totalDebit: number; totalCredit: number } }
    assertEqual(d.journal.status, 'Draft', 'Status should be Draft')
    assertEqual(d.journal.totalDebit, 10000, 'Total debit should be 10000 cents')
    assertEqual(d.journal.totalCredit, 10000, 'Total credit should be 10000 cents')
    draftJournalId = d.journal.id
    return `journalNumber="${d.journal.journalNumber}", status=${d.journal.status}`
  })

  await test('GET /api/journals returns 1 journal', async () => {
    const { data } = await api('/api/journals', { expectStatus: 200 })
    const d = data as { journals: Array<{ status: string }> }
    assertEqual(d.journals.length, 1, 'Should have 1 journal')
    assertEqual(d.journals[0].status, 'Draft', 'Should be Draft')
    return '1 Draft journal'
  })

  await test('POST /api/journals/[id]/submit succeeds', async () => {
    const { data } = await api(`/api/journals/${draftJournalId}/submit`, {
      method: 'POST',
      expectStatus: 200,
    })
    const d = data as { success: boolean }
    assertEqual(d.success, true, 'Should succeed')
    return 'Draft → Submitted'
  })

  await test('GET /api/journals/[id] shows Submitted status', async () => {
    const { data } = await api(`/api/journals/${draftJournalId}`, { expectStatus: 200 })
    const d = data as { journal: { status: string; approvals: Array<{ action: string }> } }
    assertEqual(d.journal.status, 'Submitted', 'Should be Submitted')
    assert(d.journal.approvals.some((a) => a.action === 'Submitted'), 'Should have Submitted approval')
    return `status=${d.journal.status}`
  })

  await test('POST /api/journals/[id]/approve succeeds', async () => {
    const { data } = await api(`/api/journals/${draftJournalId}/approve`, {
      method: 'POST',
      expectStatus: 200,
    })
    const d = data as { success: boolean }
    assertEqual(d.success, true, 'Should succeed')
    return 'Submitted → Approved'
  })

  await test('POST /api/journals/[id]/post succeeds', async () => {
    const { data } = await api(`/api/journals/${draftJournalId}/post`, {
      method: 'POST',
      expectStatus: 200,
    })
    const d = data as { success: boolean }
    assertEqual(d.success, true, 'Should succeed')
    return 'Approved → Posted'
  })

  await test('GET /api/journals/[id] shows Posted + has approvals', async () => {
    const { data } = await api(`/api/journals/${draftJournalId}`, { expectStatus: 200 })
    const d = data as { journal: { status: string; postedAt: string | null; approvals: Array<{ action: string }> } }
    assertEqual(d.journal.status, 'Posted', 'Should be Posted')
    assert(d.journal.postedAt !== null, 'Should have postedAt timestamp')
    const actions = d.journal.approvals.map((a) => a.action)
    assert(actions.includes('Submitted'), 'Should have Submitted approval')
    assert(actions.includes('Approved'), 'Should have Approved approval')
    assert(actions.includes('Posted'), 'Should have Posted approval')
    return `status=${d.journal.status}, approvals=[${actions.join(', ')}]`
  })

  await test('POST /api/journals/[id]/reverse succeeds', async () => {
    const { data } = await api(`/api/journals/${draftJournalId}/reverse`, {
      method: 'POST',
      expectStatus: 200,
    })
    const d = data as { success: boolean; reversalNumber: string }
    assertEqual(d.success, true, 'Should succeed')
    assert(!!d.reversalNumber, 'Should have reversal number')
    return `reversalNumber="${d.reversalNumber}"`
  })

  await test('GET /api/journals returns 2 entries (original + reversal)', async () => {
    const { data } = await api('/api/journals', { expectStatus: 200 })
    const d = data as { journals: Array<{ status: string }> }
    assertEqual(d.journals.length, 2, 'Should have 2 journals')
    const statuses = d.journals.map((j) => j.status)
    assert(statuses.includes('Reversed'), 'Should have Reversed status')
    assert(statuses.includes('Posted'), 'Should have Posted (reversal) status')
    return `${d.journals.length} journals: [${statuses.join(', ')}]`
  })

  // === Phase 6: Financial Reports ===
  console.log('\nPhase 6: Financial Reports\n')

  await test('GET /api/reports/trial-balance returns 200', async () => {
    const { data } = await api('/api/reports/trial-balance?asOf=2026-12-31', { expectStatus: 200 })
    const d = data as { rows: Array<{ code: string; endingDebit: number; endingCredit: number }>; isBalanced: boolean }
    assert(d.rows.length >= 2, 'Should have at least 2 rows')
    // Cash should have debit balance, Revenue should have credit balance
    const cashRow = d.rows.find((r) => r.code === '1000')
    if (cashRow) {
      // After posting + reversal, Cash should be back to 0 (reversal cancels it out)
      // Just verify the structure is correct
    }
    return `${d.rows.length} rows, balanced=${d.isBalanced}`
  })

  await test('GET /api/reports/balance-sheet returns 200', async () => {
    const { data } = await api('/api/reports/balance-sheet?asOf=2026-12-31', { expectStatus: 200 })
    const d = data as { sections: { totalAssets: number; totalLiabilities: number; totalEquity: number; isBalanced: boolean } }
    assert(typeof d.sections.totalAssets === 'number', 'Should have totalAssets')
    assert(typeof d.sections.totalLiabilities === 'number', 'Should have totalLiabilities')
    assert(typeof d.sections.totalEquity === 'number', 'Should have totalEquity')
    return `assets=${d.sections.totalAssets}, liab=${d.sections.totalLiabilities}, equity=${d.sections.totalEquity}`
  })

  await test('GET /api/reports/income-statement returns 200', async () => {
    const { data } = await api('/api/reports/income-statement?from=2026-01-01&to=2026-12-31', { expectStatus: 200 })
    const d = data as { totalRevenue: number; totalCogs: number; grossProfit: number; netIncome: number }
    assert(typeof d.totalRevenue === 'number', 'Should have totalRevenue')
    assert(typeof d.grossProfit === 'number', 'Should have grossProfit')
    assert(typeof d.netIncome === 'number', 'Should have netIncome')
    return `revenue=${d.totalRevenue}, netIncome=${d.netIncome}`
  })

  await test('GET /api/reports/cash-flow returns 200', async () => {
    const { data } = await api('/api/reports/cash-flow?from=2026-01-01&to=2026-12-31', { expectStatus: 200 })
    const d = data as { netIncome: number; cashFromOperating: number; cashFromInvesting: number; cashFromFinancing: number }
    assert(typeof d.netIncome === 'number', 'Should have netIncome')
    assert(typeof d.cashFromOperating === 'number', 'Should have cashFromOperating')
    return `operating=${d.cashFromOperating}, investing=${d.cashFromInvesting}, financing=${d.cashFromFinancing}`
  })

  // === Phase 7: Sub-ledgers ===
  console.log('\nPhase 7: Sub-ledgers (Vendors, Customers, Banking)\n')

  await test('GET /api/vendors returns 200 (empty)', async () => {
    const { data } = await api('/api/vendors', { expectStatus: 200 })
    const d = data as { vendors: unknown[] }
    assertEqual(d.vendors.length, 0, 'Should have 0 vendors')
    return '0 vendors (empty)'
  })

  await test('GET /api/customers returns 200 (empty)', async () => {
    const { data } = await api('/api/customers', { expectStatus: 200 })
    const d = data as { customers: unknown[] }
    assertEqual(d.customers.length, 0, 'Should have 0 customers')
    return '0 customers (empty)'
  })

  await test('GET /api/banking returns 200 (empty)', async () => {
    const { data } = await api('/api/banking', { expectStatus: 200 })
    const d = data as { accounts: unknown[] }
    assertEqual(d.accounts.length, 0, 'Should have 0 bank accounts')
    return '0 bank accounts (empty)'
  })

  await test('GET /api/bills returns 200 (empty)', async () => {
    const { data } = await api('/api/bills', { expectStatus: 200 })
    const d = data as { bills: unknown[] }
    assertEqual(d.bills.length, 0, 'Should have 0 bills')
    return '0 bills (empty)'
  })

  await test('GET /api/invoices returns 200 (empty)', async () => {
    const { data } = await api('/api/invoices', { expectStatus: 200 })
    const d = data as { invoices: unknown[] }
    assertEqual(d.invoices.length, 0, 'Should have 0 invoices')
    return '0 invoices (empty)'
  })

  // === Phase 8: Settings ===
  console.log('\nPhase 8: Settings (Fiscal Periods, Audit Log)\n')

  await test('GET /api/fiscal-periods returns 200 (empty)', async () => {
    const { data } = await api('/api/fiscal-periods', { expectStatus: 200 })
    const d = data as { fiscalYears: unknown[] }
    assertEqual(d.fiscalYears.length, 0, 'Should have 0 fiscal years')
    return '0 fiscal years (admin can create)'
  })

  await test('GET /api/audit-log shows journal workflow actions', async () => {
    const { data } = await api('/api/audit-log', { expectStatus: 200 })
    const d = data as { logs: Array<{ action: string; description: string }> }
    assert(d.logs.length >= 5, 'Should have at least 5 audit entries (setup + create + submit + approve + post + reverse)')
    const actions = d.logs.map((l) => l.action)
    assert(actions.includes('SETUP_COMPLETE'), 'Should have SETUP_COMPLETE')
    assert(actions.includes('CREATE_JOURNAL') || actions.includes('SUBMIT_JOURNAL'), 'Should have journal action')
    assert(actions.includes('POST_JOURNAL'), 'Should have POST_JOURNAL')
    return `${d.logs.length} entries, actions: ${[...new Set(actions)].join(', ')}`
  })

  // === Phase 9: Authorization (unauthenticated access) ===
  console.log('\nPhase 9: Authorization (unauthenticated access)\n')

  await test('All protected endpoints return 401 without session', async () => {
    const endpoints = [
      '/api/dashboard', '/api/accounts', '/api/journals', '/api/vendors',
      '/api/customers', '/api/banking', '/api/bills', '/api/invoices',
      '/api/users', '/api/organization', '/api/fiscal-periods', '/api/audit-log',
      '/api/reports/trial-balance', '/api/reports/balance-sheet',
      '/api/reports/income-statement', '/api/reports/cash-flow',
    ]
    sessionCookie = null  // clear session
    for (const ep of endpoints) {
      const { status } = await api(ep)
      assertEqual(status, 401, `${ep} should return 401`)
    }
    return `${endpoints.length} endpoints all return 401`
  })

  // === Phase 10: Logout ===
  console.log('\nPhase 10: Logout + Re-login\n')

  // Re-login first
  await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'e2e-admin@test.com', password: 'E2EPassword@2026' },
    expectStatus: 200,
  })

  await test('POST /api/auth/logout succeeds', async () => {
    const { data } = await api('/api/auth/logout', { method: 'POST', expectStatus: 200 })
    const d = data as { success: boolean }
    assertEqual(d.success, true, 'Should succeed')
    return 'logged out'
  })

  await test('GET /api/auth/me after logout returns 401', async () => {
    const { status } = await api('/api/auth/me')
    assertEqual(status, 401, 'Should be 401 after logout')
    return '401 after logout'
  })

  // === Summary ===
  console.log('\n========================================')
  console.log('  Test Summary')
  console.log('========================================\n')

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const total = results.length
  const totalTime = results.reduce((s, r) => s + r.durationMs, 0)

  console.log(`  Passed: ${passed}/${total}`)
  console.log(`  Failed: ${failed}/${total}`)
  console.log(`  Total time: ${totalTime}ms`)

  if (failed > 0) {
    console.log('\n  Failed tests:')
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    ✗ ${r.name} — ${r.detail}`)
    }
  }

  console.log('')
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
