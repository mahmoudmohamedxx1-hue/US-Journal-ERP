/**
 * Database connection module — works in both desktop (SQLite) and cloud (PostgreSQL) modes.
 *
 * - Desktop: DATABASE_URL=file:./db/custom.db (SQLite)
 * - Vercel/Cloud: DATABASE_URL=postgresql://... (PostgreSQL)
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Only resolve file paths for SQLite (not PostgreSQL)
if (process.env.DATABASE_URL?.startsWith('file:')) {
  try {
    const path = require('path')
    const fs = require('fs')
    let pathPart = process.env.DATABASE_URL.slice('file:'.length)
    const qIdx = pathPart.indexOf('?')
    if (qIdx >= 0) pathPart = pathPart.slice(0, qIdx)
    const dbPath = path.resolve(pathPart)
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    process.env.DATABASE_URL = `file:${dbPath}`
  } catch {
    // Edge runtime or read-only FS — use URL as-is
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
