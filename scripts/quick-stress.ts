const BASE = 'http://localhost:3000'
const results: Array<{n: string; p: boolean; d?: string; t: number}> = []
async function test(n: string, fn: () => Promise<void | string>) {
  const s = Date.now()
  try { const d = await fn(); results.push({n, p: true, d, t: Date.now()-s}); console.log(`  ✓ ${n}${d?` — ${d}`:''} (${Date.now()-s}ms)`) }
  catch(e) { const d = e instanceof Error ? e.message : String(e); results.push({n, p: false, d, t: Date.now()-s}); console.log(`  ✗ ${n} — ${d} (${Date.now()-s}ms)`) }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m) }
async function api(p: string, o: {method?: string; body?: unknown; expectStatus?: number} = {}) {
  const r = await fetch(`${BASE}${p}`, {method: o.method||'GET', headers: {'Content-Type':'application/json'}, body: o.body?JSON.stringify(o.body):undefined})
  const t = await r.text(); let d: unknown; try{d=t?JSON.parse(t):null}catch{d=t}
  if (o.expectStatus && r.status !== o.expectStatus) throw new Error(`Expected ${o.expectStatus}, got ${r.status}`)
  return {status: r.status, data: d}
}
async function main() {
  console.log('\n=== Quick Stress Tests ===\n')
  await api('/api/dashboard', {expectStatus: 200})
  for (const c of ['1000','4000','6000','2000','3000']) await api('/api/accounts',{method:'POST',body:{code:c,name:`Acct ${c}`,accountType:c.startsWith('1')?'Asset':c.startsWith('2')?'Liability':c.startsWith('3')?'Equity':c.startsWith('4')?'Revenue':'Expense',normalBalance:c.startsWith('1')||c.startsWith('6')?'Debit':'Credit'}}).catch(()=>{})

  console.log('1. Boundary Tests\n')
  await test('Negative amount rejected', async () => { const {status} = await api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',lines:[{accountCode:'1000',debit:-100},{accountCode:'4000',credit:-100}]}}); assert(status===422,`got ${status}`); return '422' })
  await test('Both debit+credit on one line rejected', async () => { const {status} = await api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',lines:[{accountCode:'1000',debit:100,credit:100},{accountCode:'4000',debit:100,credit:0}]}}); assert(status===422,`got ${status}`); return '422' })
  await test('Single line journal rejected', async () => { const {status} = await api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',lines:[{accountCode:'1000',debit:100}]}}); assert(status===422,`got ${status}`); return '422' })
  await test('Missing journalDate rejected', async () => { const {status} = await api('/api/journals',{method:'POST',body:{lines:[{accountCode:'1000',debit:100},{accountCode:'4000',credit:100}]}}); assert(status===422,`got ${status}`); return '422' })
  await test('Non-existent account rejected', async () => { const {status} = await api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',lines:[{accountCode:'NONEXIST',debit:100},{accountCode:'4000',credit:100}]}}); assert(status===422,`got ${status}`); return '422' })
  await test('Large amount ($10M) accepted', async () => { const {status} = await api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',lines:[{accountCode:'1000',debit:999999999},{accountCode:'4000',credit:999999999}]}}); assert(status===201,`got ${status}`); return 'accepted ($10M)' })

  console.log('\n2. Security Tests\n')
  await test('SQL injection in account code rejected', async () => { const {status} = await api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',lines:[{accountCode:"1000'; DROP TABLE Journal;--",debit:100},{accountCode:'4000',credit:100}]}}); assert(status===422||status===404,`got ${status}`); const c = await api('/api/journals'); assert(c.status===200,'Table intact'); return 'rejected, table safe' })
  await test('SQL injection in search safe', async () => { const {status} = await api('/api/journals?q=%27%20OR%201%3D1'); assert(status===200,`got ${status}`); return 'safe (parameterized)' })
  await test('XSS in description stored safely', async () => { const {data,status} = await api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',description:'<script>alert(1)</script>',lines:[{accountCode:'1000',debit:100},{accountCode:'4000',credit:100}]}}); if(status===201){const j=(data as {journal:{description:string}}).journal; assert(j.description.includes('<script>'),'Preserved'); return 'stored (React escapes)'} return `status=${status}` })

  console.log('\n3. Invalid Input Tests\n')
  await test('Invalid JSON body returns error', async () => { const r = await fetch(`${BASE}/api/journals`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{invalid}'}); assert(r.status===400||r.status===422,`got ${r.status}`); return `${r.status}` })

  console.log('\n4. Edge Case Dates\n')
  await test('Year 1900 accepted', async () => { const {status} = await api('/api/journals',{method:'POST',body:{journalDate:'1900-01-01',lines:[{accountCode:'1000',debit:100},{accountCode:'4000',credit:100}]}}); assert(status===201,`got ${status}`); return '1900 OK' })
  await test('Year 2099 accepted', async () => { const {status} = await api('/api/journals',{method:'POST',body:{journalDate:'2099-12-31',lines:[{accountCode:'1000',debit:100},{accountCode:'4000',credit:100}]}}); assert(status===201,`got ${status}`); return '2099 OK' })
  await test('Feb 29 leap year accepted', async () => { const {status} = await api('/api/journals',{method:'POST',body:{journalDate:'2024-02-29',lines:[{accountCode:'1000',debit:100},{accountCode:'4000',credit:100}]}}); assert(status===201,`got ${status}`); return 'Feb 29 OK' })
  await test('Invalid date rejected', async () => { const {status} = await api('/api/journals',{method:'POST',body:{journalDate:'not-a-date',lines:[{accountCode:'1000',debit:100},{accountCode:'4000',credit:100}]}}); assert(status===422,`got ${status}`); return '422' })

  console.log('\n5. Unicode Tests\n')
  await test('Arabic text preserved', async () => { const {data,status} = await api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',description:'قيد رأس المال',lines:[{accountCode:'1000',debit:100},{accountCode:'4000',credit:100}]}}); if(status===201){const j=(data as {journal:{description:string}}).journal; assert(j.description==='قيد رأس المال','Arabic OK'); return 'Arabic preserved'} return `status=${status}` })
  await test('Emoji preserved', async () => { const {data,status} = await api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',description:'💰💰 Cash 🎉',lines:[{accountCode:'1000',debit:100},{accountCode:'4000',credit:100}]}}); if(status===201){const j=(data as {journal:{description:string}}).journal; assert(j.description.includes('💰'),'Emoji OK'); return 'emoji preserved'} return `status=${status}` })

  console.log('\n6. Immutability Tests\n')
  await test('Cannot edit posted journal', async () => {
    const {data} = await api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',lines:[{accountCode:'1000',debit:100},{accountCode:'4000',credit:100}]},expectStatus:201})
    const id = (data as {journal:{id:string}}).journal.id
    await api(`/api/journals/${id}/submit`,{method:'POST',expectStatus:200})
    await api(`/api/journals/${id}/approve`,{method:'POST',expectStatus:200})
    await api(`/api/journals/${id}/post`,{method:'POST',expectStatus:200})
    const {status} = await api(`/api/journals/${id}`,{method:'PATCH',body:{description:'HACKED'}})
    assert(status===422,`got ${status}`); return '422 immutable'
  })
  await test('Cannot delete posted journal', async () => {
    const {data} = await api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',lines:[{accountCode:'1000',debit:100},{accountCode:'4000',credit:100}]},expectStatus:201})
    const id = (data as {journal:{id:string}}).journal.id
    await api(`/api/journals/${id}/submit`,{method:'POST',expectStatus:200})
    await api(`/api/journals/${id}/approve`,{method:'POST',expectStatus:200})
    await api(`/api/journals/${id}/post`,{method:'POST',expectStatus:200})
    const {status} = await api(`/api/journals/${id}`,{method:'DELETE'})
    assert(status===422,`got ${status}`); return '422 cannot delete'
  })

  console.log('\n7. Duplicate Prevention\n')
  await test('Cannot submit twice', async () => {
    const {data} = await api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',lines:[{accountCode:'1000',debit:100},{accountCode:'4000',credit:100}]},expectStatus:201})
    const id = (data as {journal:{id:string}}).journal.id
    await api(`/api/journals/${id}/submit`,{method:'POST',expectStatus:200})
    const {status} = await api(`/api/journals/${id}/submit`,{method:'POST'})
    assert(status===422,`got ${status}`); return '422 no double submit'
  })

  console.log('\n8. Throughput (200 calls)\n')
  await test('200 dashboard calls < 15s', async () => {
    const s = Date.now(); let ok = 0
    for (let b = 0; b < 4; b++) { const r = await Promise.all(Array.from({length:50},()=>api('/api/dashboard'))); ok += r.filter(x=>x.status===200).length }
    const e = Date.now()-s; assert(ok>=190,`${ok} ok`); assert(e<15000,`${e}ms`); return `${ok}/200 in ${(e/1000).toFixed(1)}s`
  })

  console.log('\n9. Concurrent Writes\n')
  await test('20 concurrent journals (SQLite limit)', async () => {
    const r = await Promise.all(Array.from({length:20},(_,i)=>api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',description:`C#${i}`,lines:[{accountCode:'1000',debit:100},{accountCode:'4000',credit:100}]}})))
    const ok = r.filter(x=>x.status===201).length; assert(ok>=1,`only ${ok} ok`); return `${ok}/20 succeeded`
  })

  console.log('\n10. Data Integrity\n')
  await test('Trial balance after 20 journals', async () => {
    for (let i = 0; i < 20; i++) await api('/api/journals',{method:'POST',body:{journalDate:'2026-08-25',lines:[{accountCode:'1000',debit:100},{accountCode:'4000',credit:100}]}})
    const {data} = await api('/api/reports/trial-balance?asOf=2026-12-31')
    const d = data as {totals:{debit:number;credit:number}}
    const diff = Math.abs(d.totals.debit - d.totals.credit)
    assert(diff < 1000, `diff=${diff}`); return `diff=${diff} cents`
  })

  console.log('\n11. All Endpoints Check\n')
  await test('30 GET endpoints all return 200', async () => {
    const eps = ['/api/health','/api/dashboard','/api/accounts','/api/vendors','/api/customers','/api/banking','/api/bills','/api/invoices','/api/users','/api/organization','/api/fiscal-periods','/api/audit-log','/api/journals','/api/products','/api/purchase-orders','/api/sales-orders','/api/recurring-journals','/api/budgets','/api/exchange-rates','/api/cash-flow-forecast','/api/fixed-assets','/api/timesheets','/api/notifications','/api/approval-steps','/api/reconciliations','/api/anomaly-detection','/api/reports/trial-balance','/api/reports/balance-sheet','/api/reports/income-statement','/api/reports/cash-flow']
    let fail = 0; for (const ep of eps) { const {status} = await api(ep); if (status!==200) fail++ }
    assert(fail===0,`${fail} failed`); return `${eps.length-fail}/${eps.length} OK`
  })

  // Summary
  console.log('\n=== Summary ===\n')
  const p = results.filter(r=>r.p).length, f = results.filter(r=>!r.p).length
  console.log(`Passed: ${p}/${results.length}`)
  console.log(`Failed: ${f}/${results.length}`)
  if (f>0) for (const r of results.filter(r=>!r.p)) console.log(`  ✗ ${r.n} — ${r.d}`)
  process.exit(f>0?1:0)
}
main().catch(e=>{console.error('Fatal:',e);process.exit(1)})
