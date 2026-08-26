const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()
async function main() {
  const journals = await db.journal.findMany({ select: { journalNumber: true, currency: true }, take: 5 })
  console.log('Sample journals:')
  for (const j of journals) console.log(`  ${j.journalNumber}: ${j.currency}`)
  const counts = await db.journal.groupBy({ by: ['currency'], _count: true })
  console.log('Currency counts:', counts)
}
main().catch(console.error).finally(() => db.$disconnect())
