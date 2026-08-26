const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()
async function main() {
  const r = await db.journal.updateMany({ where: { currency: 'USD' }, data: { currency: 'EGP' } })
  console.log(`Updated ${r.count} journals from USD → EGP`)
}
main().catch(console.error).finally(() => db.$disconnect())
