const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()
async function main() {
  const r1 = await db.invoice.updateMany({ where: { currency: 'EGP' }, data: { currency: 'USD' } })
  console.log(`Updated ${r1.count} invoices EGP → USD`)
  const r2 = await db.bill.updateMany({ where: { currency: 'EGP' }, data: { currency: 'USD' } })
  console.log(`Updated ${r2.count} bills EGP → USD`)
  const r3 = await db.payment.updateMany({ where: { currency: 'EGP' }, data: { currency: 'USD' } })
  console.log(`Updated ${r3.count} payments EGP → USD`)
}
main().catch(console.error).finally(() => db.$disconnect())
