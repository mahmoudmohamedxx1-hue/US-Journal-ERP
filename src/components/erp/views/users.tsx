'use client'

import * as React from 'react'
import { Plus, Shield, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLES, formatDate } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const ROLE_META: Record<string, { color: string; bg: string; description: string }> = {
  Viewer:        { color: 'text-slate-700',    bg: 'bg-slate-50',    description: 'Read-only access to reports and dashboards' },
  Accountant:   { color: 'text-blue-700',    bg: 'bg-blue-50',    description: 'Create and edit draft journals' },
  Approver:     { color: 'text-amber-700',   bg: 'bg-amber-50',   description: 'Review, approve or reject submitted journals' },
  Controller:   { color: 'text-teal-700',    bg: 'bg-teal-50',    description: 'Post approved journals, reverse, close periods' },
  Administrator: { color: 'text-purple-700',   bg: 'bg-purple-50',   description: 'Manage users, organization, and system settings' },
  Auditor:      { color: 'text-emerald-700', bg: 'bg-emerald-50', description: 'Read-only access to records and audit logs' },
}

export function UsersView() {
  const [users, setUsers] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Settings · Users & Roles</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Users & Roles</h1>
          <p className="text-sm text-muted-foreground">
            Manage team members and their permissions. Role-based access controls every action.
          </p>
        </div>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Invite User
        </Button>
      </div>

      {/* Role legend */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((role) => {
          const meta = ROLE_META[role]
          return (
            <Card key={role} className="p-3">
              <div className="flex items-start gap-2">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-md', meta.bg, meta.color)}>
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{role}</div>
                  <div className="text-[11px] text-muted-foreground">{meta.description}</div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-[2rem_1fr_1fr_8rem_8rem_3rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <div></div>
            <div>Name</div>
            <div>Email</div>
            <div>Role</div>
            <div>Status</div>
            <div></div>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : (
            users.map((u) => {
              const meta = ROLE_META[u.role] || ROLE_META.Viewer
              return (
                <div key={u.id} className="grid grid-cols-[2rem_1fr_1fr_8rem_8rem_3rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm hover:bg-accent/5">
                  <div className={cn('flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold', meta.bg, meta.color)}>
                    {u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                  <div>
                    <Badge variant="outline" className={cn('text-[10px]', meta.bg, meta.color)}>{u.role}</Badge>
                  </div>
                  <div>
                    {u.active ? (
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Suspended</Badge>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
