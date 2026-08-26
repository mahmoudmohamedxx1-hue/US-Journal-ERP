const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()
async function main() {
  const lines = await db.journalLine.findMany({ take: 5, select: { id: true, debit: true, credit: true } })
  for (const l of lines) console.log(l)
}
main().catch(console.error).finally(() => db.$disconnect())
