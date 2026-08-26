const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()
async function main() {
  const banks = await db.bankAccount.findMany({ where: { organizationId: 'org-us-journal' } })
  const total = banks.reduce((s, b) => s + b.balance, 0)
  console.log('Banks:', banks.length)
  for (const b of banks) console.log(`  ${b.accountName}: ${b.balance}`)
  console.log('Total:', total)
}
main().catch(console.error).finally(() => db.$disconnect())
