const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()
async function main() {
  const j = await db.journal.findFirst({ where: { journalNumber: 'JE-2026-0079' }, select: { journalNumber: true, status: true } })
  console.log('JE-0079 status:', j)
}
main().catch(console.error).finally(() => db.$disconnect())
