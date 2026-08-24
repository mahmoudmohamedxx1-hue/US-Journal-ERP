/**
 * Cross-platform post-build script.
 * Copies .next/static and public/ into .next/standalone/ so the
 * Next.js standalone server can serve static assets.
 *
 * Also copies prisma/schema.prisma so the setup wizard can create
 * the database schema on first run.
 *
 * Works on Windows, macOS, and Linux (no shell-specific commands).
 */
const { cpSync, existsSync, mkdirSync } = require('fs')
const { join } = require('path')

const ROOT = join(__dirname, '..')
const STANDALONE_DIR = join(ROOT, '.next', 'standalone')
const STATIC_DIR = join(ROOT, '.next', 'static')
const PUBLIC_DIR = join(ROOT, 'public')
const SCHEMA_SRC = join(ROOT, 'prisma', 'schema.prisma')

if (!existsSync(STANDALONE_DIR)) {
  console.error('✗ Standalone directory not found. Run `next build` first.')
  process.exit(1)
}

// Copy .next/static -> .next/standalone/.next/static
if (existsSync(STATIC_DIR)) {
  const destStatic = join(STANDALONE_DIR, '.next', 'static')
  cpSync(STATIC_DIR, destStatic, { recursive: true })
  console.log('✓ Copied .next/static -> .next/standalone/.next/static')
} else {
  console.warn('! .next/static not found — skipping')
}

// Copy public/ -> .next/standalone/public
if (existsSync(PUBLIC_DIR)) {
  const destPublic = join(STANDALONE_DIR, 'public')
  cpSync(PUBLIC_DIR, destPublic, { recursive: true })
  console.log('✓ Copied public/ -> .next/standalone/public')
} else {
  console.warn('! public/ not found — skipping')
}

// Copy prisma/schema.prisma -> .next/standalone/prisma/schema.prisma
// (needed by the first-run Setup Wizard to create tables)
if (existsSync(SCHEMA_SRC)) {
  const destPrisma = join(STANDALONE_DIR, 'prisma')
  if (!existsSync(destPrisma)) mkdirSync(destPrisma, { recursive: true })
  cpSync(SCHEMA_SRC, join(destPrisma, 'schema.prisma'))
  console.log('✓ Copied prisma/schema.prisma -> .next/standalone/prisma/schema.prisma')
} else {
  console.warn('! prisma/schema.prisma not found — skipping')
}

console.log('✓ Post-build copy complete')

