'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Wallet,
  Users,
  Building2,
  Landmark,
  Receipt,
  ClipboardList,
  Settings,
  ScrollText,
  ChevronDown,
  Plus,
  Moon,
  Sun,
  Bell,
  Search,
  CircleUser,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useErpStore, type ErpView } from '@/lib/erp-store'
import { useAuth } from '@/app/page'
import { OrgSwitcher } from '@/components/erp/org-switcher'

interface NavItem {
  id: ErpView
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Accounting',
    items: [
      { id: 'accounts', label: 'Chart of Accounts', icon: BookOpen },
      { id: 'journals', label: 'Journal Register', icon: FileText },
      { id: 'reports', label: 'Financial Reports', icon: ClipboardList },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'vendors', label: 'Vendors (AP)', icon: Receipt },
      { id: 'customers', label: 'Customers (AR)', icon: Users },
      { id: 'banking', label: 'Cash & Banking', icon: Landmark },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'settings-users', label: 'Users & Roles', icon: CircleUser },
      { id: 'settings-org', label: 'Organization', icon: Building2 },
      { id: 'settings-periods', label: 'Fiscal Periods', icon: Wallet },
      { id: 'audit-log', label: 'Audit Log', icon: ScrollText },
    ],
  },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { view, setView, openJournal } = useErpStore()
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const handleNav = (v: ErpView) => {
    setView(v)
    setMobileOpen(false)
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0 lg:static lg:z-auto',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            UJ
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-sm font-semibold">US Journal ERP</div>
            <div className="text-[10px] text-sidebar-foreground/60">
              Accounting & Finance
            </div>
          </div>
        </div>

        {/* New Journal button */}
        <div className="p-3">
          <Button
            onClick={() => setView('journal-new')}
            className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
            size="sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Journal Entry
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {group.label}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active =
                    view === item.id ||
                    (item.id === 'journals' && view === 'journal-detail') ||
                    (item.id === 'journals' && view === 'journal-new')
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => handleNav(item.id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors text-left',
                          active
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User chip at the bottom */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/50 px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
              {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-sm font-medium truncate">{user.name}</div>
              <div className="text-[10px] text-sidebar-foreground/60">{user.role}</div>
            </div>
            <Settings className="h-4 w-4 text-sidebar-foreground/60" />
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
          <button
            className="lg:hidden -ml-1 p-1"
            onClick={() => setMobileOpen((s) => !s)}
            aria-label="Toggle sidebar"
          >
            <Settings className="h-5 w-5" />
          </button>

          {/* Org switcher — shows the authenticated user's organization */}
          <OrgSwitcher />

          {/* Search */}
          <div className="hidden md:flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Search journals, accounts, vendors…"
                className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-sm outline-none focus:border-accent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setView('journals')
                  }
                }}
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <button
                aria-label="Toggle theme"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto max-w-[1600px] p-4 lg:p-6">{children}</div>
        </main>

        {/* Footer */}
        <footer className="border-t bg-muted/30 px-4 py-2 text-center text-[11px] text-muted-foreground lg:px-6">
          US Journal ERP — Professional journal management &amp; accounting system ·
          All financial data is server-stored with audit logging
        </footer>
      </div>
    </div>
  )
}
