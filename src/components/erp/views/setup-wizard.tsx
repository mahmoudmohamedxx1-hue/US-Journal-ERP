'use client'

import * as React from 'react'
import {
  Building2,
  Lock,
  Mail,
  User,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

type Step = 'welcome' | 'organization' | 'admin' | 'finalizing' | 'done'

interface SetupResult {
  organization: { id: string; name: string; currency: string }
  adminUser: { id: string; email: string; name: string; role: string }
}

export function SetupWizard({ onComplete }: { onComplete: (result: SetupResult) => void }) {
  const [step, setStep] = React.useState<Step>('welcome')

  // Form state
  const [orgName, setOrgName] = React.useState('')
  const [adminName, setAdminName] = React.useState('')
  const [adminEmail, setAdminEmail] = React.useState('')
  const [adminPassword, setAdminPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<SetupResult | null>(null)

  const steps: Step[] = ['welcome', 'organization', 'admin', 'finalizing']
  const currentIdx = steps.indexOf(step)

  const handleInitialize = async () => {
    if (adminPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (adminPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setStep('finalizing')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/setup/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: orgName,
          adminName,
          adminEmail,
          adminPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Setup failed')
      }
      setResult(data)
      setStep('done')
      toast.success('Setup complete! You can now sign in.')
      setTimeout(() => onComplete(data), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed')
      setStep('admin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-100 p-4">
      <div className="w-full max-w-2xl">
        <Card className="shadow-xl">
          {/* Header with logo */}
          <CardHeader className="space-y-3 border-b">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                UJ
              </div>
              <div className="flex-1">
                <div className="text-xl font-semibold">US Journal ERP</div>
                <div className="text-sm text-muted-foreground">First-run Setup</div>
              </div>
              {step !== 'welcome' && step !== 'finalizing' && step !== 'done' && (
                <Badge variant="outline" className="text-xs">
                  Step {currentIdx} of {steps.length - 1}
                </Badge>
              )}
            </div>
            {/* Progress bar */}
            {step !== 'welcome' && step !== 'finalizing' && step !== 'done' && (
              <div className="flex gap-1.5 mt-2">
                {steps.slice(1, -1).map((s, i) => (
                  <div
                    key={s}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-colors',
                      i < currentIdx ? 'bg-emerald-500' :
                      i === currentIdx ? 'bg-accent' : 'bg-muted',
                    )}
                  />
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent className="p-6">
            {/* === Step 1: Welcome === */}
            {step === 'welcome' && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-semibold">Welcome to US Journal ERP</h2>
                  <p className="text-sm text-muted-foreground">
                    This wizard will set up your organization and create the first administrator account.
                    After setup, you can configure your chart of accounts, vendors, customers, and begin
                    recording transactions.
                  </p>
                </div>

                <Separator />

                <div className="grid gap-3">
                  <Feature icon={<Building2 className="h-4 w-4" />} title="Create Organization" desc="Set your company name and base currency" />
                  <Feature icon={<Shield className="h-4 w-4" />} title="Create Administrator" desc="First user with full Administrator role" />
                </div>

                <Separator />

                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <strong>Security note:</strong> Your password is bcrypt-hashed before storage.
                  All financial data is stored locally in a SQLite database on this machine.
                  No data leaves your computer.
                </div>

                <Button className="w-full" size="lg" onClick={() => setStep('organization')}>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Get Started
                </Button>
              </div>
            )}

            {/* === Step 2: Organization === */}
            {step === 'organization' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold">Organization details</h2>
                  <p className="text-sm text-muted-foreground">
                    This information appears on financial reports and dashboards.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="orgName">Organization Name <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="orgName"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        className="pl-9"
                        placeholder="Acme Corporation, LLC"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="legalName">Legal Name (optional)</Label>
                    <Input
                      id="legalName"
                      placeholder="Acme Corporation, LLC — incorporated in Delaware"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="taxId">Tax ID (optional)</Label>
                    <Input id="taxId" placeholder="EIN / VAT / Tax registration number" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="currency">Base Currency</Label>
                    <Input id="currency" value="USD — United States Dollar" disabled className="bg-muted/50" />
                    <p className="text-xs text-muted-foreground">
                      Multi-currency support is planned for a future release.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('welcome')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button className="flex-1" onClick={() => setStep('admin')} disabled={!orgName.trim()}>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* === Step 3: Administrator === */}
            {step === 'admin' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold">Create the Administrator account</h2>
                  <p className="text-sm text-muted-foreground">
                    This user will have full access to all modules including Users &amp; Roles, Fiscal Periods,
                    Chart of Accounts, and Organization settings.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="adminName">Full Name <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="adminName"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        className="pl-9"
                        placeholder="Sarah Chen"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="adminEmail">Email <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="adminEmail"
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="pl-9"
                        placeholder="admin@yourcompany.com"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="adminPassword">Password <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="adminPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="pl-9 pr-10"
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
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
                    {adminPassword && adminPassword.length < 8 && (
                      <p className="text-xs text-amber-600">
                        Password must be at least 8 characters ({adminPassword.length}/8)
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">Confirm Password <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-9"
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                      />
                    </div>
                    {confirmPassword && confirmPassword !== adminPassword && (
                      <p className="text-xs text-red-600">Passwords do not match</p>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('organization')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleInitialize}
                    disabled={!adminName.trim() || !adminEmail.trim() || adminPassword.length < 8 || adminPassword !== confirmPassword}
                  >
                    Complete Setup
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* === Step 4: Finalizing === */}
            {step === 'finalizing' && (
              <div className="space-y-5 py-8 text-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-accent" />
                <div>
                  <h2 className="text-lg font-semibold">Setting up your workspace…</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Creating organization and administrator account. This takes ~3 seconds.
                  </p>
                </div>
              </div>
            )}

            {/* === Done === */}
            {step === 'done' && result && (
              <div className="space-y-5 py-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Setup complete!</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your accounting workspace is ready.
                  </p>
                </div>

                <div className="rounded-md border bg-muted/30 p-4 text-left space-y-1.5 text-sm">
                  <Row label="Organization" value={result.organization.name} />
                  <Row label="Admin Email" value={result.adminUser.email} />
                  <Row label="Admin Role" value={result.adminUser.role} />
                </div>

                <p className="text-xs text-muted-foreground">
                  Redirecting to login…
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
