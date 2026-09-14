/**
 * Database connection module — works in both desktop (SQLite) and cloud (PostgreSQL) modes.
 *
 * - Desktop: DATABASE_URL=file:./db/custom.db (SQLite, auto-creates directory)
 * - Vercel/Cloud: DATABASE_URL=postgresql://... (PostgreSQL via Prisma)
 *
 * On Vercel, the filesystem is read-only except /tmp, so we can't use SQLite.
 * The environment variable DATABASE_URL determines which database to use.
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function resolveDatabaseUrl() {
  let url = process.env.DATABASE_URL

  if (!url) {
    // Default to SQLite for desktop mode
    url = 'file:./db/custom.db'
    process.env.DATABASE_URL = url
  }

  // Only resolve file paths for SQLite (not PostgreSQL)
  if (url.startsWith('file:')) {
    try {
      const path = require('path')
      const fs = require('fs')
      let pathPart = url.slice('file:'.length)
      const qIdx = pathPart.indexOf('?')
      if (qIdx >= 0) pathPart = pathPart.slice(0, qIdx)

      const dbPath = path.resolve(pathPart)
      const dir = path.dirname(dbPath)
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true })
          console.log(`[db] Created database directory: ${dir}`)
        } catch (e) {
          console.error(`[db] Failed to create directory ${dir}:`, e)
        }
      }
      process.env.DATABASE_URL = `file:${dbPath}`
    } catch {
      // If path/fs not available (edge runtime), just use the URL as-is
    }
  }

  return url
}

resolveDatabaseUrl()

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

// Cache Prisma client in development to avoid connection exhaustion
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
