'use client'

import * as React from 'react'
import { AppShell } from '@/components/erp/app-shell'
import { useErpStore } from '@/lib/erp-store'
import { LoginView } from '@/components/erp/views/login'
import { DashboardView } from '@/components/erp/views/dashboard'
import { ChartOfAccountsView } from '@/components/erp/views/chart-of-accounts'
import { JournalRegisterView } from '@/components/erp/views/journal-register'
import { JournalNewView } from '@/components/erp/views/journal-new'
import { JournalDetailView } from '@/components/erp/views/journal-detail'
import { ReportsView } from '@/components/erp/views/reports'
import { VendorsView } from '@/components/erp/views/vendors'
import { CustomersView } from '@/components/erp/views/customers'
import { BankingView } from '@/components/erp/views/banking'
import { UsersView } from '@/components/erp/views/users'
import { OrganizationView } from '@/components/erp/views/organization'
import { FiscalPeriodsView } from '@/components/erp/views/fiscal-periods'
import { AuditLogView } from '@/components/erp/views/audit-log'

interface AuthUser {
  id: string
  email: string
  name: string
  role: string
}

// Lightweight context so child components (AppShell) can read the current user.
export const AuthContext = React.createContext<{
  user: AuthUser
  logout: () => Promise<void>
} | null>(null)

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthContext.Provider')
  return ctx
}

export default function Home() {
  const view = useErpStore((s) => s.view)
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [bootstrapping, setBootstrapping] = React.useState(true)

  // On mount, check if already authenticated (cookie-based session)
  React.useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        if (d?.user) setUser(d.user)
      })
      .catch(() => {})
      .finally(() => !cancelled && setBootstrapping(false))
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    useErpStore.getState().setView('dashboard')
  }

  if (bootstrapping) {
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

  if (!user) {
    return <LoginView onSuccess={(u) => setUser(u)} />
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
        {view === 'vendors' && <VendorsView />}
        {view === 'customers' && <CustomersView />}
        {view === 'banking' && <BankingView />}
        {view === 'settings-users' && <UsersView />}
        {view === 'settings-org' && <OrganizationView />}
        {view === 'settings-periods' && <FiscalPeriodsView />}
        {view === 'audit-log' && <AuditLogView />}
      </AppShell>
    </AuthContext.Provider>
  )
}
