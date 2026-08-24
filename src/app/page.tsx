'use client'

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
import { UsersView } from '@/components/erp/views/users'
import { OrganizationView } from '@/components/erp/views/organization'
import { FiscalPeriodsView } from '@/components/erp/views/fiscal-periods'
import { AuditLogView } from '@/components/erp/views/audit-log'

export default function Home() {
  const view = useErpStore((s) => s.view)

  return (
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
  )
}
