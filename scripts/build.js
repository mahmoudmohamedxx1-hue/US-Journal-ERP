/**
 * Build script — works on both local and Vercel.
 * Automatically switches Prisma provider based on DATABASE_URL.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const dbUrl = process.env.DATABASE_URL || ''

// Switch Prisma provider if PostgreSQL
if (dbUrl.startsWith('postgres')) {
  console.log('[build] DATABASE_URL is PostgreSQL — switching Prisma provider')
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma')
  let schema = fs.readFileSync(schemaPath, 'utf8')
  schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"')
  fs.writeFileSync(schemaPath, schema)
  console.log('[build] Switched to postgresql')
} else {
  console.log('[build] DATABASE_URL is SQLite or not set — keeping sqlite')
}

// Generate Prisma client
console.log('[build] Running prisma generate...')
execSync('npx prisma generate', { stdio: 'inherit' })

// Build Next.js
console.log('[build] Running next build...')
execSync('npx next build', { stdio: 'inherit' })
