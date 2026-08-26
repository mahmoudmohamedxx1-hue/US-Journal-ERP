const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()
async function main() {
  const org = await db.organization.findFirst()
  if (!org) return console.log('No org found')
  const currency = org.baseCurrency || org.currency || 'EGP'
  const result = await db.journal.updateMany({
    where: { currency: 'USD' },
    data: { currency },
  })
  console.log(`Updated ${result.count} journals from USD → ${currency}`)
}
main().catch(console.error).finally(() => db.$disconnect())
