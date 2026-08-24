'use client'

import * as React from 'react'
import {
  Building2,
  Lock,
  Mail,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface AuthUser {
  id: string
  email: string
  name: string
  role: string
}

export function LoginView({ onSuccess }: { onSuccess: (user: AuthUser) => void }) {
  const [email, setEmail] = React.useState('controller@usjournal.test')
  const [password, setPassword] = React.useState('Control@2026')
  const [showPassword, setShowPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Email and password are required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Login failed')
      }
      toast.success(`Welcome back, ${data.user.name}`)
      onSuccess(data.user)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const quickFill = (em: string, pw: string) => {
    setEmail(em)
    setPassword(pw)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-100 p-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left: brand panel */}
        <div className="hidden lg:flex flex-col gap-6 p-8 rounded-xl bg-primary text-primary-foreground shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-lg">
              UJ
            </div>
            <div>
              <div className="text-xl font-semibold">US Journal ERP</div>
              <div className="text-sm text-primary-foreground/70">
                Professional Accounting & Finance
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold leading-tight">
              The accounting system your business can rely on.
            </h2>
            <p className="text-sm text-primary-foreground/80 leading-relaxed">
              US Journal ERP brings your general ledger, journal management, accounts payable
              and receivable, banking, and financial reporting into a single, auditable,
              role-based platform — installed on your PC, with data stored locally and securely.
            </p>
          </div>

          <div className="grid gap-3 mt-4">
            <Feature icon={<Building2 className="h-4 w-4" />} title="Full General Ledger" desc="Hierarchical chart of accounts with multi-period support" />
            <Feature icon={<Shield className="h-4 w-4" />} title="Audit-Grade Workflow" desc="Draft → Submit → Approve → Post → Reverse with full history" />
            <Feature icon={<Lock className="h-4 w-4" />} title="Role-Based Access" desc="6 role types — Administrator, Controller, Approver, Accountant, Auditor, Viewer" />
          </div>

          <Separator className="bg-primary-foreground/20 my-2" />
          <div className="text-xs text-primary-foreground/60">
            All financial data is stored locally in an encrypted SQLite database.
            No data leaves your machine.
          </div>
        </div>

        {/* Right: login form */}
        <Card className="w-full max-w-md mx-auto shadow-lg">
          <CardHeader className="space-y-2">
            <div className="lg:hidden flex items-center gap-2 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
                UJ
              </div>
              <span className="font-semibold">US Journal ERP</span>
            </div>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>
              Enter your credentials to access the accounting workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <Separator className="my-4" />

            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Demo Accounts (click to fill)
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <QuickAccount label="Controller" email="controller@usjournal.test" password="Control@2026" onClick={quickFill} />
                <QuickAccount label="Administrator" email="admin@usjournal.test" password="Admin@2026" onClick={quickFill} />
                <QuickAccount label="Approver" email="approver@usjournal.test" password="Approve@2026" onClick={quickFill} />
                <QuickAccount label="Accountant" email="accountant@usjournal.test" password="Accounts@2026" onClick={quickFill} />
                <QuickAccount label="Auditor" email="auditor@usjournal.test" password="Audit@2026" onClick={quickFill} />
                <QuickAccount label="Viewer" email="viewer@usjournal.test" password="View@2026" onClick={quickFill} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-foreground/10 text-primary-foreground shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-primary-foreground/70">{desc}</div>
      </div>
    </div>
  )
}

function QuickAccount({
  label,
  email,
  password,
  onClick,
}: {
  label: string
  email: string
  password: string
  onClick: (email: string, password: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(email, password)}
      className="rounded-md border bg-card px-2 py-1.5 text-left hover:border-accent hover:bg-accent/5 transition-colors"
    >
      <div className="text-xs font-medium">{label}</div>
      <div className="text-[10px] text-muted-foreground truncate">{email}</div>
    </button>
  )
}
