/**
 * Cross-platform post-build script.
 * Copies .next/static and public/ into .next/standalone/ so the
 * Next.js standalone server can serve static assets.
 *
 * Works on Windows, macOS, and Linux (no shell-specific commands).
 */
const { cpSync, existsSync, mkdirSync } = require('fs')
const { join } = require('path')

const ROOT = join(__dirname, '..')
const STANDALONE_DIR = join(ROOT, '.next', 'standalone')
const STATIC_DIR = join(ROOT, '.next', 'static')
const PUBLIC_DIR = join(ROOT, 'public')

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

console.log('✓ Post-build copy complete')
