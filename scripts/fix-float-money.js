/**
 * Fix non-integer money values in JournalLine.
 *
 * Some seed entries stored dollar amounts as if they were cents (e.g., 26388.89
 * dollars stored as the literal number 26388.89, not 2638889 cents).
 * SQLite's dynamic typing allowed floats to be stored in INTEGER columns.
 *
 * This script:
 *   1. Finds all JournalLine rows with non-integer debit/credit values
 *   2. Multiplies by 100 (converts dollars → cents) and rounds to int
 *
 * Run: node scripts/fix-float-money.js
 */
const { PrismaClient } = require('@prisma/client')
const path = require('path')
process.env.DATABASE_URL = `file:${path.join('/home/z/my-project/db/custom.db')}`
const db = new PrismaClient()

async function main() {
  // Use raw query because Prisma's typed client might silently cast floats to ints
  const result = await db.$queryRawUnsafe(`
    SELECT id, debit, credit FROM JournalLine
    WHERE debit != CAST(debit AS INTEGER) OR credit != CAST(credit AS INTEGER)
  `)
  console.log(`Found ${result.length} rows with non-integer money values`)
  let fixed = 0
  for (const row of result) {
    const newDebit = Math.round(Number(row.debit) * 100)
    const newCredit = Math.round(Number(row.credit) * 100)
    console.log(`  id=${row.id}: debit ${row.debit} → ${newDebit}, credit ${row.credit} → ${newCredit}`)
    await db.$executeRawUnsafe(
      `UPDATE JournalLine SET debit = ?, credit = ? WHERE id = ?`,
      newDebit, newCredit, row.id
    )
    fixed++
  }
  console.log(`✓ Fixed ${fixed} rows`)
}
main().catch(console.error).finally(() => db.$disconnect())
