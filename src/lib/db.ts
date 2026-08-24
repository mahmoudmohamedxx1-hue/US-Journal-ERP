import { PrismaClient } from '@prisma/client'
import * as path from 'path'
import * as fs from 'fs'

const { mkdirSync, existsSync } = fs
const { dirname, resolve } = path

/**
 * Resolve the SQLite database path from DATABASE_URL.
 *
 * Supports:
 *   - file:./db/custom.db        (relative to cwd)
 *   - file:/abs/path/custom.db   (absolute)
 *   - file:${appData}/...         (Electron userData placeholder, replaced at runtime)
 *
 * Auto-creates the parent directory if missing — fixes:
 *   "PrismaClientInitializationError: Unable to open the database file"
 * which happened when the directory didn't exist (e.g. fresh CI run,
 * fresh desktop install, or containerized dev environment).
 */
function ensureDatabasePath() {
  let url = process.env.DATABASE_URL
  if (!url) {
    // Fallback to a sane default — relative to project root
    url = 'file:./db/custom.db'
    process.env.DATABASE_URL = url
  }

  if (url.startsWith('file:')) {
    let pathPart = url.slice('file:'.length)
    // Strip query params (e.g. "?connection_limit=1")
    const qIdx = pathPart.indexOf('?')
    if (qIdx >= 0) pathPart = pathPart.slice(0, qIdx)

    // Resolve relative paths against cwd
    const dbPath = resolve(pathPart)
    const dir = dirname(dbPath)
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true })
        console.log(`[db] Created database directory: ${dir}`)
      } catch (e) {
        console.error(`[db] Failed to create directory ${dir}:`, e)
      }
    }
    // Normalize to absolute path so Prisma can reliably open it
    process.env.DATABASE_URL = `file:${dbPath}`
  }
}

ensureDatabasePath()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
