'use client'
import * as React from 'react'
import { Users, Plus, Play, FileText } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/format'
import { CreateFormDialog } from '@/components/erp/create-form-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/erp/empty-state'
import { KpiCard } from '@/components/erp/kpi-card'
import { toast } from 'sonner'

export function PayrollView() {
  const [employees, setEmployees] = React.useState<Array<{id:string;employeeNumber:string;name:string;position:string|null;basicSalary:number;status:string}>>([])
  const [payslips, setPayslips] = React.useState<Array<{id:string;payPeriod:string;payDate:string;netPay:number;status:string;employee:{name:string}}>>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreateEmp, setShowCreateEmp] = React.useState(false)
  const [running, setRunning] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    Promise.all([fetch('/api/employees').then(r=>r.json()), fetch('/api/payslips').then(r=>r.json())])
      .then(([empData, psData]) => { setEmployees(empData.employees||[]); setPayslips(psData.payslips||[]) })
      .finally(() => setLoading(false))
  }, [])
  React.useEffect(() => { load() }, [load])

  const runPayroll = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/payroll-run', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ payPeriod: new Date().toISOString().slice(0,7), payDate: new Date().toISOString().slice(0,10) }) })
      const d = await res.json(); if (!res.ok) throw new Error(d.error)
      toast.success(`Payroll run complete — ${d.payslipsCreated} payslips created`)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Payroll run failed') }
    finally { setRunning(false) }
  }

  const totalPayroll = payslips.reduce((s, p) => s + p.netPay, 0)
  const activeEmps = employees.filter(e => e.status === 'Active').length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">HR</span><span>·</span><span>{employees.length} employees</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
        <p className="text-sm text-muted-foreground">Manage employees, run payroll, and generate payslips.</p></div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={runPayroll} disabled={running}><Play className="mr-1.5 h-3.5 w-3.5" />{running ? 'Running…' : 'Run Payroll'}</Button>
          <Button size="sm" onClick={() => setShowCreateEmp(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Employee</Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="Active Employees" value={String(activeEmps)} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Total Net Pay (current period)" value={formatMoney(totalPayroll)} icon={<FileText className="h-4 w-4" />} variant="accent" />
      </div>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-4"><Skeleton className="h-9 w-full" /></div>
        : employees.length === 0 ? <EmptyState icon={Users} title="No employees yet" description="Add employees to run payroll." action={<Button size="sm" onClick={() => setShowCreateEmp(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />New Employee</Button>} />
        : <div className="overflow-x-auto"><div className="grid grid-cols-[6rem_1fr_6rem_6rem_4rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-w-[600px]"><div>Number</div><div>Name</div><div className="text-right">Salary</div><div className="text-right">Period Net</div><div>Status</div></div>
          {employees.map(e => { const ps = payslips.find(p => p.employee?.name === e.name); return (
            <div key={e.id} className="grid grid-cols-[6rem_1fr_6rem_6rem_4rem] items-center gap-2 border-b border-border/40 px-3 py-2 text-sm min-w-[600px]">
              <div className="font-mono text-xs">{e.employeeNumber}</div><div><div className="font-medium">{e.name}</div><div className="text-[10px] text-muted-foreground">{e.position||'—'}</div></div>
              <div className="text-right font-mono text-xs tabular-nums">{formatMoney(e.basicSalary)}</div>
              <div className="text-right font-mono text-xs tabular-nums">{ps ? formatMoney(ps.netPay) : '—'}</div>
              <div><Badge variant="outline" className="text-[10px]">{e.status}</Badge></div>
            </div>)})}</div>}
      </CardContent></Card>
      <CreateFormDialog open={showCreateEmp} onOpenChange={setShowCreateEmp} title="New Employee" apiEndpoint="/api/employees" successMessage="Employee created" onSuccess={() => setTimeout(()=>load(),100)} fields={[
        {key:'employeeNumber',label:'Employee Number',type:'text',required:true,placeholder:'EMP-001'},
        {key:'name',label:'Full Name',type:'text',required:true,placeholder:'Ahmed Mohamed'},
        {key:'email',label:'Email',type:'email',placeholder:'ahmed@company.com'},
        {key:'phone',label:'Phone',type:'text',placeholder:'+20 100 123 4567'},
        {key:'position',label:'Position',type:'text',placeholder:'Senior Accountant'},
        {key:'hireDate',label:'Hire Date',type:'date',required:true,defaultValue:new Date().toISOString().slice(0,10)},
        {key:'basicSalary',label:'Basic Salary (monthly)',type:'number',required:true,placeholder:'15000',helpText:'In base currency (EGP)'},
        {key:'allowances',label:'Allowances (monthly)',type:'number',placeholder:'2000'},
        {key:'deductions',label:'Deductions (monthly)',type:'number',placeholder:'500'},
        {key:'socialInsurance',label:'Social Insurance',type:'number',placeholder:'1000'},
        {key:'taxRate',label:'Tax Rate (%)',type:'number',placeholder:'15',helpText:'Enter percentage (e.g. 15 for 15%)'},
        {key:'bankAccount',label:'Bank Account',type:'text',placeholder:'****1234'},
      ]} />
    </div>
  )
}
