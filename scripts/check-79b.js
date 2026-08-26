const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()
async function main() {
  const j = await db.journal.findFirst({ where: { journalNumber: 'JE-2026-0079' }, select: { journalNumber: true, status: true, reference: true, description: true } })
  console.log('JE-0079:', j)
  const all = await db.journal.findMany({
    where: { source: 'Reversal' },
    select: { journalNumber: true, status: true, reference: true, description: true },
    orderBy: { journalNumber: 'desc' },
    take: 5,
  })
  console.log('Recent reversal-source journals:')
  for (const r of all) console.log(`  ${r.journalNumber} - ${r.status} - ${r.reference} - ${r.description}`)
}
main().catch(console.error).finally(() => db.$disconnect())
