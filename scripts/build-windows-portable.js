/**
 * Build Windows portable ZIP without Wine.
 *
 * Downloads the Windows Electron binary, copies it + the Next.js standalone
 * + the compiled Electron main process into a single portable folder,
 * then zips it up.
 *
 * Run: node scripts/build-windows-portable.js
 */
const { mkdirSync, copyFileSync, existsSync, rmSync, readdirSync, cpSync, writeFileSync } = require('fs')
const { join } = require('path')
const { execSync } = require('child_process')

const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'download')
const PORTABLE_DIR = join(OUT_DIR, 'USJournalERP-Windows-Portable')
const ZIP_PATH = join(OUT_DIR, 'USJournalERP-Windows-Portable.zip')

console.log('=== US Journal ERP — Windows Portable Build ===\n')

// 1. Verify Next.js standalone was built
const standaloneDir = join(ROOT, '.next', 'standalone')
if (!existsSync(standaloneDir)) {
  console.error('✗ Next.js standalone build not found. Run `bun run build` first.')
  process.exit(1)
}
console.log('✓ Next.js standalone found:', standaloneDir)

// 2. Verify Electron main process was compiled
const electronMain = join(ROOT, 'electron', 'dist', 'main.js')
if (!existsSync(electronMain)) {
  console.error('✗ Electron main.js not found. Run `bun run compile:electron` first.')
  process.exit(1)
}
console.log('✓ Electron main.js found:', electronMain)

// 3. Verify Windows Electron binary is downloaded
const electronExe = join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
if (!existsSync(electronExe)) {
  console.error('✗ Windows electron.exe not found. Run:')
  console.error('  ELECTRON_INSTALL_PLATFORM=win32 ELECTRON_INSTALL_ARCH=x64 node node_modules/electron/install.js')
  process.exit(1)
}
console.log('✓ Windows electron.exe found:', electronExe)

// 4. Clean output directory
console.log('\nCleaning output directory...')
if (existsSync(PORTABLE_DIR)) rmSync(PORTABLE_DIR, { recursive: true, force: true })
if (existsSync(ZIP_PATH)) rmSync(ZIP_PATH, { force: true })
mkdirSync(PORTABLE_DIR, { recursive: true })
console.log('✓ Output directory ready')

// 5. Copy Windows Electron runtime files
console.log('\nCopying Windows Electron runtime...')
const electronDist = join(ROOT, 'node_modules', 'electron', 'dist')
const entries = readdirSync(electronDist)
for (const entry of entries) {
  cpSync(join(electronDist, entry), join(PORTABLE_DIR, entry), { recursive: true })
}
console.log(`✓ Copied ${entries.length} Electron runtime entries`)

// 6. Rename electron.exe to USJournalERP.exe
const targetExe = join(PORTABLE_DIR, 'electron.exe')
const renamedExe = join(PORTABLE_DIR, 'USJournalERP.exe')
if (existsSync(targetExe)) {
  // Rename via copy + delete (more portable)
  cpSync(targetExe, renamedExe)
  rmSync(targetExe)
}
console.log('✓ Renamed electron.exe → USJournalERP.exe')

// 7. Copy resources (app.asar + standalone Next.js)
console.log('\nCopying app resources...')
const resourcesDir = join(PORTABLE_DIR, 'resources')
mkdirSync(resourcesDir, { recursive: true })

// Copy default_app.asar (Electron's default — needed as fallback)
const defaultAppAsar = join(electronDist, 'resources', 'default_app.asar')
if (existsSync(defaultAppAsar)) {
  copyFileSync(defaultAppAsar, join(resourcesDir, 'default_app.asar'))
  console.log('✓ Copied default_app.asar')
}

// Create our app.asar containing the compiled Electron main + preload + package.json
// Use asar CLI from node_modules
const asarCli = join(ROOT, 'node_modules', '.bin', 'asar')
const asarOut = join(resourcesDir, 'app.asar')
console.log('\nPacking app.asar...')

// Stage the asar contents in a temporary directory so the internal structure
// matches what package.json's "main" field expects ("electron/dist/main.js").
const { mkdtempSync } = require('fs')
const { tmpdir } = require('os')
const stagingDir = mkdtempSync(join(tmpdir(), 'usj-asar-'))
console.log(`  Staging dir: ${stagingDir}`)

// Create the internal structure: electron/dist/main.js, electron/dist/preload.js, package.json
mkdirSync(join(stagingDir, 'electron', 'dist'), { recursive: true })
cpSync(join(ROOT, 'electron', 'dist', 'main.js'), join(stagingDir, 'electron', 'dist', 'main.js'))
cpSync(join(ROOT, 'electron', 'dist', 'preload.js'), join(stagingDir, 'electron', 'dist', 'preload.js'))

// Copy package.json (Electron reads "main" from here to find the entry point)
copyFileSync(join(ROOT, 'package.json'), join(stagingDir, 'package.json'))

// Also copy electron/preload.js (referenced in build files config)
if (existsSync(join(ROOT, 'electron', 'preload.js'))) {
  mkdirSync(join(stagingDir, 'electron'), { recursive: true })
  copyFileSync(join(ROOT, 'electron', 'preload.js'), join(stagingDir, 'electron', 'preload.js'))
}

try {
  execSync(`"${asarCli}" pack "${stagingDir}" "${asarOut}"`, { stdio: 'inherit' })
  console.log('✓ app.asar created (with package.json + electron/dist/main.js)')
} catch (e) {
  console.error('✗ Failed to create app.asar:', e.message)
  process.exit(1)
} finally {
  // Clean up staging dir
  try { rmSync(stagingDir, { recursive: true, force: true }) } catch {}
}

// Copy the Next.js standalone as unpacked resources (in `resources/app/`)
console.log('\nCopying Next.js standalone to resources/app/...')
const appDir = join(resourcesDir, 'app')
mkdirSync(appDir, { recursive: true })

// Copy standalone contents (server.js, .next/, node_modules, package.json)
const standaloneEntries = readdirSync(standaloneDir)
for (const entry of standaloneEntries) {
  cpSync(join(standaloneDir, entry), join(appDir, entry), { recursive: true })
}
console.log(`✓ Copied ${standaloneEntries.length} standalone entries`)

// Copy public/ folder into the app dir
const publicDir = join(ROOT, 'public')
if (existsSync(publicDir)) {
  cpSync(publicDir, join(appDir, 'public'), { recursive: true })
  console.log('✓ Copied public/ folder')
}

// Copy .next/static/ (client-side chunks)
const staticDir = join(ROOT, '.next', 'static')
if (existsSync(staticDir)) {
  cpSync(staticDir, join(appDir, '.next', 'static'), { recursive: true })
  console.log('✓ Copied .next/static/ folder')
}

// 8. Create launcher batch file
console.log('\nCreating launcher batch file...')
const batContent = `@echo off
title US Journal ERP
cd /d "%~dp0"
echo Starting US Journal ERP...
start "" "USJournalERP.exe"
exit
`
writeFileSync(join(PORTABLE_DIR, 'Start US Journal ERP.bat'), batContent, 'utf8')
console.log('✓ Created Start US Journal ERP.bat')

// 9. Create README.txt
console.log('\nCreating README.txt...')
const readmeContent = `# US Journal ERP - Windows Portable

## How to run

1. Unzip this folder anywhere on your Windows PC (Desktop, Documents, C:\\, etc.)
2. Double-click "Start US Journal ERP.bat"
3. The app window will open - wait ~10 seconds for the Next.js server to start

## No Node.js installation required

The app uses Electron's built-in Node.js (via ELECTRON_RUN_AS_NODE=1)
to run the bundled Next.js standalone server. You do NOT need to install
Node.js, Bun, or any other runtime on your PC. Everything is self-contained.

## First run

On first launch, the app will:
- Create a database at %APPDATA%/us-journal-erp/data/us-journal-erp.db
- Show the login screen

The database starts EMPTY. To populate demo data, run the seed script
(from the source repo) before building.

## Demo credentials (after seeding)

| Role          | Email                         | Password         |
|---------------|-------------------------------|------------------|
| Administrator | admin@usjournal.test          | Admin@2026       |
| Controller    | controller@usjournal.test    | Control@2026     |
| Approver      | approver@usjournal.test       | Approve@2026     |
| Accountant    | accountant@usjournal.test     | Accounts@2026    |
| Auditor       | auditor@usjournal.test        | Audit@2026       |
| Viewer        | viewer@usjournal.test         | View@2026        |

## Files in this folder

- USJournalERP.exe - the Electron-based desktop app (includes Node.js)
- "Start US Journal ERP.bat" - double-click this to launch the app
- resources/app/ - the Next.js standalone server (spawns automatically)
- resources/app.asar - the Electron main process code
- *.dll, *.pak, icudtl.dat, etc. - Chromium runtime files (required)

## System requirements

- Windows 10 or later (64-bit)
- 1 GB free RAM
- 500 MB free disk space
- NO Node.js installation needed - everything is bundled

## Troubleshooting

If the app shows "Failed to start the accounting server":
1. Make sure no other program is using port 3000
2. Restart your PC (clears zombie processes)
3. Check Windows Task Manager for any existing USJournalERP.exe processes
   and end them
4. Make sure the folder is fully extracted (not running from inside the ZIP)

## Uninstall

Just delete this folder. App data is stored in %APPDATA%/us-journal-erp/.
`
writeFileSync(join(PORTABLE_DIR, 'README.txt'), readmeContent, 'utf8')
console.log('✓ Created README.txt')

// 10. Zip everything up
console.log('\nCreating ZIP archive...')
try {
  // Use zip command if available (Linux/macOS)
  execSync(`cd "${OUT_DIR}" && zip -r -q "USJournalERP-Windows-Portable.zip" "USJournalERP-Windows-Portable/"`, { stdio: 'inherit' })
  console.log('✓ ZIP created using zip command')
} catch {
  // Fallback: use Node's tar/zip via npm package
  console.log('zip command not available, trying alternative...')
  try {
    execSync(`cd "${OUT_DIR}" && tar -czf "USJournalERP-Windows-Portable.tar.gz" "USJournalERP-Windows-Portable/"`, { stdio: 'inherit' })
    console.log('✓ tar.gz created (use this if zip is unavailable)')
  } catch (e2) {
    console.error('✗ Failed to create archive:', e2.message)
  }
}

// 11. Clean up the unpacked folder (keep only the ZIP)
console.log('\nCleaning up...')
rmSync(PORTABLE_DIR, { recursive: true, force: true })

console.log('\n=== Build complete ===')
if (existsSync(ZIP_PATH)) {
  const stats = require('fs').statSync(ZIP_PATH)
  console.log(`Output: ${ZIP_PATH}`)
  console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`)
} else {
  const tarPath = join(OUT_DIR, 'USJournalERP-Windows-Portable.tar.gz')
  if (existsSync(tarPath)) {
    const stats = require('fs').statSync(tarPath)
    console.log(`Output: ${tarPath}`)
    console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`)
  }
}
