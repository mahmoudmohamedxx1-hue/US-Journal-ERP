const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()
async function main() {
  // Sum debit for account 1111's lines
  const lines = await db.journalLine.findMany({
    where: { account: { code: '1111' }, journal: { status: 'Posted' } },
    select: { debit: true, credit: true },
  })
  const totalDr = lines.reduce((s, l) => s + l.debit, 0)
  const totalCr = lines.reduce((s, l) => s + l.credit, 0)
  console.log(`Prisma sum: Dr=${totalDr} Cr=${totalCr} Net=${totalDr - totalCr}`)
  console.log(`Lines:`, lines)
}
main().catch(console.error).finally(() => db.$disconnect())
