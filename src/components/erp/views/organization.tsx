'use client'

import * as React from 'react'
import { Building2, Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export function OrganizationView() {
  const [org, setOrg] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({ name: '', legalName: '', taxId: '', currency: 'USD' })

  React.useEffect(() => {
    fetch('/api/organization')
      .then((r) => r.json())
      .then((d) => {
        setOrg(d.organization)
        setForm({
          name: d.organization.name,
          legalName: d.organization.legalName || '',
          taxId: d.organization.taxId || '',
          currency: d.organization.currency,
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    // Optimistic update only — full PATCH endpoint omitted for brevity
    toast.success('Organization settings saved (demo)')
    setSaving(false)
  }

  if (loading) return <Skeleton className="h-96 w-full" />

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">Settings · Organization</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization</h1>
        <p className="text-sm text-muted-foreground">
          Configure organization identity, tax ID, and base currency.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organization Profile
          </CardTitle>
          <CardDescription>This information appears on financial reports.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="legalName">Legal Name</Label>
            <Input id="legalName" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="taxId">Tax ID</Label>
            <Input id="taxId" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Base Currency</Label>
            <Input id="currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
          <Info label="Organization ID" value={org.id} mono />
          <Info label="Created" value={new Date(org.createdAt).toLocaleString()} />
          <Info label="Last Updated" value={new Date(org.updatedAt).toLocaleString()} />
          <Info label="Multi-tenant" value={<Badge variant="outline" className="text-[10px]">Enabled</Badge>} />
        </CardContent>
      </Card>
    </div>
  )
}

function Info({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={mono ? 'font-mono text-xs' : 'text-sm font-medium'}>{value}</span>
    </div>
  )
}
