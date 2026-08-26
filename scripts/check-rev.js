const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()
async function main() {
  const all = await db.journal.findMany({
    where: { OR: [{ reference: { contains: 'Reversal of JE-2026-0079' } }, { description: { contains: 'Reversal of JE-2026-0079' } }] },
    select: { journalNumber: true, status: true, reference: true, description: true }
  })
  console.log('Found reversal entries:', all)
}
main().catch(console.error).finally(() => db.$disconnect())
