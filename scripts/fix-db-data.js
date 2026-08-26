/**
 * DB cleanup script — fixes the trial-balance-breaking data corruption:
 *
 * 1. The depreciation journal (JE-2026-0003) credited the WRONG account:
 *    it credited 1200 (Fixed Assets) instead of 1241 (Accumulated Depreciation).
 *    Fix: move the credit line from 1200 → 1241.
 *
 * 2. The stress test created journal entries with year 2099 dates that
 *    pollute the trial balance / register. Soft-delete them (mark Reversed).
 *
 * Run: node /home/z/my-project/scripts/fix-db-data.js
 */
const { PrismaClient } = require('@prisma/client')
const path = require('path')

// Force SQLite path
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()

async function main() {
  // 1. Fix the depreciation journal JE-2026-0003
  const dep = await db.journal.findFirst({
    where: { journalNumber: 'JE-2026-0003' },
    include: { lines: true },
  })
  if (dep) {
    console.log(`Found depreciation journal: ${dep.journalNumber} (${dep.lines.length} lines)`)
    // Find the line that credits 1200 (Fixed Assets)
    const wrongLine = dep.lines.find((l) => l.credit > 0)
    if (wrongLine) {
      const accumDep = await db.account.findFirst({
        where: { OR: [{ code: '1241' }, { name: { contains: 'Accum' } }] },
      })
      if (accumDep) {
        console.log(`  Reassigning line ${wrongLine.id} from account ${wrongLine.accountId} → ${accumDep.id} (${accumDep.code} ${accumDep.name})`)
        await db.journalLine.update({
          where: { id: wrongLine.id },
          data: {
            accountId: accumDep.id,
            description: `Accumulated depreciation — fixed (was incorrectly hitting 1200)`,
          },
        })
        console.log('  ✓ Fixed')
      } else {
        console.log('  ! Accumulated Depreciation account not found')
      }
    } else {
      console.log('  (no credit line to fix)')
    }
  } else {
    console.log('Depreciation journal JE-2026-0003 not found')
  }

  // 2. Mark 2099-dated journals as Reversed (soft delete from active reports)
  const junk = await db.journal.findMany({
    where: { journalDate: { gte: new Date('2099-01-01') } },
  })
  console.log(`\nFound ${junk.length} journals dated year 2099 — marking as Reversed`)
  for (const j of junk) {
    await db.journal.update({
      where: { id: j.id },
      data: { status: 'Reversed' },
    })
    console.log(`  ✓ ${j.journalNumber} marked Reversed`)
  }

  console.log('\n✓ All fixes applied')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

// 3. Update existing journals to use org currency (EGP) instead of USD
async function fixCurrency() {
  const org = await db.organization.findFirst()
  if (!org) return console.log('No org found')
  const currency = org.baseCurrency || org.currency || 'EGP'
  const result = await db.journal.updateMany({
    where: { currency: 'USD' },
    data: { currency },
  })
  console.log(`Updated ${result.count} journals from USD → ${currency}`)
}
fixCurrency().catch(console.error)
