'use client'

import * as React from 'react'
import { AppShell } from '@/components/erp/app-shell'
import { useErpStore } from '@/lib/erp-store'
import { LoginView } from '@/components/erp/views/login'
import { SetupWizard } from '@/components/erp/views/setup-wizard'
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

type AppPhase = 'bootstrapping' | 'needs-setup' | 'login' | 'authenticated'

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
  const [phase, setPhase] = React.useState<AppPhase>('bootstrapping')
  const [user, setUser] = React.useState<AuthUser | null>(null)

  // On mount: check if database needs setup, then check auth
  React.useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      // Step 1: Check if setup is needed (DB empty?)
      try {
        const setupRes = await fetch('/api/setup/status')
        const setupData = await setupRes.json()
        if (cancelled) return
        if (setupData.needsSetup) {
          setPhase('needs-setup')
          return
        }
      } catch {
        // If setup/status fails, fall through to auth check
      }

      // Step 2: Check if already authenticated
      try {
        const meRes = await fetch('/api/auth/me')
        if (cancelled) return
        if (meRes.ok) {
          const meData = await meRes.json()
          if (meData?.user) {
            setUser(meData.user)
            setPhase('authenticated')
            return
          }
        }
      } catch {
        // ignore
      }
      if (cancelled) return
      setPhase('login')
    }

    bootstrap()
    return () => { cancelled = true }
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    useErpStore.getState().setView('dashboard')
    setPhase('login')
  }

  const handleSetupComplete = () => {
    setPhase('login')
  }

  const handleLoginSuccess = (u: AuthUser) => {
    setUser(u)
    setPhase('authenticated')
  }

  // --- Render based on phase ---

  if (phase === 'bootstrapping') {
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

  if (phase === 'needs-setup') {
    return <SetupWizard onComplete={handleSetupComplete} />
  }

  if (phase === 'login' || !user) {
    return <LoginView onSuccess={handleLoginSuccess} />
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
