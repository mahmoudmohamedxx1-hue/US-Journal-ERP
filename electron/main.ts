/**
 * US Journal ERP — Electron main process
 *
 * Responsibilities:
 *  - Spawn the bundled Next.js standalone server as a child process
 *  - Open a BrowserWindow that loads the Next.js URL
 *  - Manage the SQLite database file location (app.getPath('userData'))
 *  - Handle app lifecycle (window-all-closed, activate, before-quit)
 */
import { app, BrowserWindow, shell } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs'

const isDev = !app.isPackaged
const PORT = 3000
const URL = `http://localhost:${PORT}`

let nextServer: ChildProcess | null = null
let mainWindow: BrowserWindow | null = null

/**
 * Log to both console AND a log file in userData so users can
 * troubleshoot when the app fails to start.
 */
function log(message: string) {
  console.log(message)
  try {
    const userData = app.getPath('userData')
    if (!existsSync(userData)) mkdirSync(userData, { recursive: true })
    appendFileSync(join(userData, 'usj-app.log'), `[${new Date().toISOString()}] ${message}\n`)
  } catch {
    // ignore
  }
}

/**
 * In production, the SQLite DB lives in the user's app data directory
 * (e.g. %APPDATA%/us-journal-erp/data.db on Windows).
 * We write the DATABASE_URL to a `.env` file before the Next.js server starts
 * so Prisma picks it up.
 */
function ensureDatabasePath() {
  const userData = app.getPath('userData')
  const dbDir = join(userData, 'data')
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
  const dbPath = join(dbDir, 'us-journal-erp.db')
  // Write the .env file in the app directory so Prisma can find it
  const envPath = join(process.resourcesPath ?? process.cwd(), 'app', '.env')
  try {
    writeFileSync(envPath, `DATABASE_URL=file:${dbPath}\n`)
  } catch {
    // Fallback to cwd if resourcesPath is not writable
    writeFileSync(join(process.cwd(), '.env'), `DATABASE_URL=file:${dbPath}\n`)
  }
  log(`[Electron] Database path: ${dbPath}`)
  return dbPath
}

/**
 * Start the Next.js server.
 * In dev, we assume `bun run dev` is already running on port 3000.
 * In production, we spawn the standalone server bundled with the app.
 *
 * IMPORTANT: We use Electron's built-in Node.js (via process.execPath +
 * ELECTRON_RUN_AS_NODE=1) instead of spawning external `node`. This means
 * the user doesn't need to install Node.js separately — everything they
 * need is bundled in the portable ZIP.
 */
function startNextServer() {
  if (isDev) {
    log('[Electron] Dev mode — assuming Next.js dev server is running on port 3000')
    return
  }

  const serverPath = join(process.resourcesPath, 'app', 'server.js')
  log(`[Electron] Starting Next.js server: ${serverPath}`)
  log(`[Electron] Using Electron's bundled Node.js: ${process.execPath}`)

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    NODE_ENV: 'production',
    PORT: String(PORT),
    HOSTNAME: '127.0.0.1',
    // Tell Electron to run as plain Node.js (no GUI)
    ELECTRON_RUN_AS_NODE: '1',
  }

  // process.execPath is the path to the Electron binary (USJournalERP.exe).
  // With ELECTRON_RUN_AS_NODE=1, it behaves like Node.js — perfect for
  // spawning our Next.js standalone server without requiring Node.js install.
  nextServer = spawn(process.execPath, [serverPath], {
    env,
    cwd: join(process.resourcesPath, 'app'),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  nextServer.stdout?.on('data', (data) => {
    log(`[Next.js] ${data.toString().trim()}`)
  })
  nextServer.stderr?.on('data', (data) => {
    log(`[Next.js error] ${data.toString().trim()}`)
  })
  nextServer.on('exit', (code) => {
    log(`[Next.js] Server exited with code ${code}`)
    nextServer = null
  })
}

/**
 * Wait for the Next.js server to respond before opening the window.
 */
async function waitForServer(maxAttempts = 30): Promise<boolean> {
  const http = await import('node:http')
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port: PORT, path: '/', timeout: 1000 }, (res) => {
          res.destroy()
          if (res.statusCode && res.statusCode < 500) resolve()
          else reject(new Error(`status ${res.statusCode}`))
        })
        req.on('error', reject)
        req.on('timeout', () => reject(new Error('timeout')))
      })
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  return false
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0f172a',
    title: 'US Journal ERP',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // Open external links in the user's default browser, not in the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  const ok = await waitForServer()
  if (!ok) {
    mainWindow?.loadURL(`data:text/html,<html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#f1f5f9"><h1 style="color:#14b8a6">US Journal ERP</h1><h2>Failed to start the accounting server</h2><p>The Next.js server did not respond in time.</p><p style="color:#94a3b8">Please restart the application. If the problem persists, check that no other program is using port ${PORT}.</p><p style="color:#94a3b8;font-size:11px">Server path: ${join(process.resourcesPath, 'app', 'server.js')}</p></body></html>`)
    return
  }
  mainWindow?.loadURL(URL)
}

// Single-instance lock — prevent multiple instances from running
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    ensureDatabasePath()
    startNextServer()
    await createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', () => {
    if (nextServer) {
      nextServer.kill('SIGTERM')
      nextServer = null
    }
  })

  process.on('exit', () => {
    if (nextServer) {
      nextServer.kill('SIGKILL')
    }
  })
}
