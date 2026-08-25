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
  AlertCircle,
  RotateCcw,
  Info,
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

export function LoginView({ onSuccess, onResetDatabase }: { onSuccess: (user: AuthUser) => void; onResetDatabase?: () => void }) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showHelp, setShowHelp] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)

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

  const handleReset = async () => {
    setResetting(true)
    try {
      const res = await fetch('/api/setup/reset', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Reset failed')
      }
      toast.success('Database reset. The Setup Wizard will appear.')
      setTimeout(() => onResetDatabase?.(), 1000)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reset failed')
      setResetting(false)
    }
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
            All financial data is stored locally in a SQLite database.
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
                    autoFocus
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
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div>{error}</div>
                    {error === 'Invalid email or password' && (
                      <button
                        type="button"
                        onClick={() => setShowHelp((s) => !s)}
                        className="text-xs underline mt-1 hover:text-destructive/80"
                      >
                        {showHelp ? 'Hide help' : 'Need help signing in?'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Help section — shows when user can't sign in */}
              {showHelp && error === 'Invalid email or password' && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Info className="h-3.5 w-3.5" />
                    Can&apos;t sign in?
                  </div>
                  <div className="space-y-1 text-amber-800">
                    <p>• Check that you&apos;re using the email and password you entered during the First-run Setup Wizard.</p>
                    <p>• Email is case-insensitive but must match exactly otherwise.</p>
                    <p>• Password must be at least 8 characters.</p>
                  </div>
                  {onResetDatabase && (
                    <div className="pt-2 border-t border-amber-200">
                      <p className="text-amber-900 mb-1">If you&apos;ve forgotten your password, you can reset the database and run the setup wizard again:</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        disabled={resetting}
                        className="border-amber-300 text-amber-900 hover:bg-amber-100"
                      >
                        {resetting ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-2 h-3.5 w-3.5" />
                        )}
                        Reset database &amp; start over
                      </Button>
                      <p className="text-[10px] text-amber-700 mt-1">
                        ⚠️ This deletes ALL data (organization, users, accounts, journals, etc.)
                      </p>
                    </div>
                  )}
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

            <div className="text-xs text-muted-foreground text-center">
              Need an account? Contact your system administrator.
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

