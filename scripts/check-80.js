const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()
async function main() {
  const j = await db.journal.findFirst({ where: { journalNumber: 'JE-2026-0080' }, select: { journalNumber: true, currency: true, exchangeRate: true } })
  console.log('JE-0080:', j)
}
main().catch(console.error).finally(() => db.$disconnect())
