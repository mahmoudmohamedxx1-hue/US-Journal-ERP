const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()

async function main() {
  // Find journals with non-integer totalDebit or totalCredit
  const rows = await db.$queryRawUnsafe(`
    SELECT id, journalNumber, totalDebit, totalCredit FROM Journal
    WHERE totalDebit != CAST(totalDebit AS INTEGER) OR totalCredit != CAST(totalCredit AS INTEGER)
  `)
  console.log(`Found ${rows.length} journals with non-integer totals`)
  for (const r of rows) {
    const newDebit = Math.round(Number(r.totalDebit) * 100)
    const newCredit = Math.round(Number(r.totalCredit) * 100)
    console.log(`  ${r.journalNumber}: totalDebit ${r.totalDebit} → ${newDebit}, totalCredit ${r.totalCredit} → ${newCredit}`)
    await db.$executeRawUnsafe(
      `UPDATE Journal SET totalDebit = ?, totalCredit = ? WHERE id = ?`,
      newDebit, newCredit, r.id
    )
  }
}
main().catch(console.error).finally(() => db.$disconnect())
