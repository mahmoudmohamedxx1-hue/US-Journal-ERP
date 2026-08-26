const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()
async function main() {
  const banks = await db.bankAccount.findMany({ select: { accountName: true, balance: true } })
  for (const b of banks) console.log(`Prisma: ${b.accountName} = ${b.balance}`)
  // Raw SQL
  const raw = await db.$queryRawUnsafe('SELECT accountName, balance FROM BankAccount')
  console.log('Raw:')
  for (const r of raw) console.log(`  ${r.accountName} = ${r.balance} (typeof: ${typeof r.balance})`)
}
main().catch(console.error).finally(() => db.$disconnect())
