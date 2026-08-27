'use client'

import * as React from 'react'
import { AppShell } from '@/components/erp/app-shell'
import { useErpStore } from '@/lib/erp-store'
import { DashboardView } from '@/components/erp/views/dashboard'
import { ChartOfAccountsView } from '@/components/erp/views/chart-of-accounts'
import { JournalRegisterView } from '@/components/erp/views/journal-register'
import { JournalNewView } from '@/components/erp/views/journal-new'
import { JournalDetailView } from '@/components/erp/views/journal-detail'
import { ReportsView } from '@/components/erp/views/reports'
import { VendorsView } from '@/components/erp/views/vendors'
import { CustomersView } from '@/components/erp/views/customers'
import { BankingView } from '@/components/erp/views/banking'
import { InvoicesView } from '@/components/erp/views/invoices'
import { BillsView } from '@/components/erp/views/bills'
import { InventoryView } from '@/components/erp/views/inventory'
import { PurchaseOrdersView } from '@/components/erp/views/purchase-orders'
import { SalesOrdersView } from '@/components/erp/views/sales-orders'
import { RecurringJournalsView } from '@/components/erp/views/recurring-journals'
import { BudgetsView } from '@/components/erp/views/budgets'
import { PaymentsView } from '@/components/erp/views/payments'
import { ExchangeRatesView } from '@/components/erp/views/exchange-rates'
import { UsersView } from '@/components/erp/views/users'
import { OrganizationView } from '@/components/erp/views/organization'
import { FiscalPeriodsView } from '@/components/erp/views/fiscal-periods'
import { AuditLogView } from '@/components/erp/views/audit-log'
import { ConsolidationView } from '@/components/erp/views/consolidation'
import { PayrollView } from '@/components/erp/views/payroll'
import { ManufacturingView } from '@/components/erp/views/manufacturing'
import { OcrScanView } from '@/components/erp/views/ocr-scan'
import { FixedAssetsView } from '@/components/erp/views/fixed-assets'
import { TimesheetsView } from '@/components/erp/views/timesheets'
import { PeriodCloseView } from '@/components/erp/views/period-close'
import { CashFlowForecastView } from '@/components/erp/views/cash-flow-forecast'
import { ReconciliationView } from '@/components/erp/views/reconciliation'
import { CustomReportView } from '@/components/erp/views/custom-report'
import { JournalImportView } from '@/components/erp/views/journal-import'
import { LoginView } from '@/components/erp/views/login'

interface AppUser {
  id: string
  email: string
  name: string
  role: string
}

// Lightweight context so child components (AppShell) can read the current user.
export const AuthContext = React.createContext<{
  user: AppUser
  logout: () => Promise<void>
} | null>(null)

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthContext.Provider')
  return ctx
}

export default function Home() {
  const view = useErpStore((s) => s.view)
  const [loading, setLoading] = React.useState(true)
  const [user, setUser] = React.useState<AppUser | null>(null)
  const [showLogin, setShowLogin] = React.useState(false)

  // On mount: check if user is authenticated via /api/auth/me
  React.useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        // Check if already authenticated
        const meRes = await fetch('/api/auth/me')
        if (cancelled) return

        if (meRes.ok) {
          const meData = await meRes.json()
          if (meData?.user) {
            setUser({
              id: meData.user.id,
              email: meData.user.email,
              name: meData.user.name,
              role: meData.user.role,
            })
            setLoading(false)
            return
          }
        }

        // Not authenticated — check if any users exist
        const orgRes = await fetch('/api/organization')
        if (cancelled) return

        if (orgRes.ok) {
          const orgData = await orgRes.json()
          if (orgData?.organization) {
            // Org exists — show login
            setShowLogin(true)
            setLoading(false)
          } else {
            // No org yet — show login (will auto-create on first login)
            setShowLogin(true)
            setLoading(false)
          }
        } else {
          setShowLogin(true)
          setLoading(false)
        }
      } catch {
        setShowLogin(true)
        setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setShowLogin(true)
  }

  // Loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold animate-pulse">
            UJ
          </div>
          <div className="text-sm text-muted-foreground">Loading US Journal ERP…</div>
        </div>
      </div>
    )
  }

  // Show login screen if not authenticated
  if (showLogin && !user) {
    return <LoginView onSuccess={(u) => { setUser(u); setShowLogin(false) }} />
  }

  return (
    <AuthContext.Provider value={{ user, logout: handleLogout }}>
      <AppShell>
        {view === 'dashboard' && <DashboardView />}
        {view === 'accounts' && <ChartOfAccountsView />}
        {view === 'journals' && <JournalRegisterView />}
        {view === 'journal-new' && <JournalNewView />}
        {view === 'journal-detail' && <JournalDetailView />}
        {view === 'reports' && <ReportsView />}
        {view === 'journal-import' && <JournalImportView />}
        {view === 'vendors' && <VendorsView />}
        {view === 'customers' && <CustomersView />}
        {view === 'banking' && <BankingView />}
        {view === 'invoices' && <InvoicesView />}
        {view === 'bills' && <BillsView />}
        {view === 'inventory' && <InventoryView />}
        {view === 'purchase-orders' && <PurchaseOrdersView />}
        {view === 'sales-orders' && <SalesOrdersView />}
        {view === 'recurring-journals' && <RecurringJournalsView />}
        {view === 'budgets' && <BudgetsView />}
        {view === 'payments' && <PaymentsView />}
        {view === 'exchange-rates' && <ExchangeRatesView />}
        {view === 'settings-users' && <UsersView />}
        {view === 'settings-org' && <OrganizationView />}
        {view === 'settings-periods' && <FiscalPeriodsView />}
        {view === 'fixed-assets' && <FixedAssetsView />}
        {view === 'timesheets' && <TimesheetsView />}
        {view === 'period-close' && <PeriodCloseView />}
        {view === 'cash-flow-forecast' && <CashFlowForecastView />}
        {view === 'reconciliation' && <ReconciliationView />}
        {view === 'custom-report' && <CustomReportView />}
        {view === 'consolidation' && <ConsolidationView />}
        {view === 'payroll' && <PayrollView />}
        {view === 'manufacturing' && <ManufacturingView />}
        {view === 'ocr-scan' && <OcrScanView />}
        {view === 'audit-log' && <AuditLogView />}
      </AppShell>
    </AuthContext.Provider>
  )
}
