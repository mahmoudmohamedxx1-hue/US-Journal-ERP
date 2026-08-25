# US Journal ERP — Build Guide

This document explains how to package US Journal ERP into a PC-installable desktop application.

## Prerequisites

- **Node.js 20+** and **Bun** (install from https://bun.sh)
- For Windows builds: any of these works
  - **On Windows**: just run the build script
  - **On macOS/Linux**: install **Wine** (`brew install wine` or `apt install wine`) to cross-compile Windows installers
- For macOS builds: a macOS machine (Apple notarization requires macOS)
- ~2 GB free disk space for build artifacts

## Quick Start (one-command build)

### Windows installer (.exe)

```bash
bun install
bun run dist:win
```

The installer will be at `release/USJournalERP-Setup-1.0.0.exe`.

### Windows portable ZIP (no installer)

If you don't have Wine and want a portable Windows app:

```bash
bun install
bun run build
bun run compile:electron
node scripts/build-windows-portable.js
```

The ZIP will be at `download/USJournalERP-Windows-Portable.zip`.

### macOS (.dmg)

```bash
bun install
bun run dist:mac
```

### Linux (.AppImage + .tar.gz)

```bash
bun install
bun run dist:linux
```

## Database Location

When the app runs, the SQLite database is stored in the user's OS-specific app data folder:

- **Windows**: `%APPDATA%/us-journal-erp/data/us-journal-erp.db`
- **macOS**: `~/Library/Application Support/us-journal-erp/data/us-journal-erp.db`
- **Linux**: `~/.config/us-journal-erp/data/us-journal-erp.db`

This is handled by Electron's `app.getPath('userData')` in `electron/main.ts`. The `DATABASE_URL` is written to a `.env` file before the Next.js server starts, so Prisma picks it up automatically.

## First Run

When the app launches for the first time, the database will be **empty** — no users, no chart of accounts, no journals.

**To seed the database with demo data**, run the seed script ONCE before building:

```bash
bun run seed
```

Or, for production deployments, expose an "Initialize Database" UI on first run.

## Default Login Credentials (Demo Data)

After seeding, the following accounts are available:

| Role          | Email                         | Password         |
|---------------|-------------------------------|------------------|
| Administrator | admin@usjournal.test          | Admin@2026       |
| Controller    | controller@usjournal.test    | Control@2026     |
| Approver      | approver@usjournal.test       | Approve@2026     |
| Accountant    | accountant@usjournal.test     | Accounts@2026    |
| Auditor       | auditor@usjournal.test        | Audit@2026       |
| Viewer        | viewer@usjournal.test         | View@2026        |

**Change these passwords in production** via the Users & Roles screen.

## App Icon

The build expects icons in the `build/` folder:

- `build/icon.ico` — Windows icon (256×256 multi-resolution)
- `build/icon.icns` — macOS icon
- `build/icons/` — Linux icons (PNG, multiple sizes)

If these are missing, electron-builder will use a default Electron icon.

## Project Structure

```
us-journal-erp/
├── electron/
│   ├── main.ts          # Electron main process
│   ├── preload.ts       # Preload script
│   ├── tsconfig.json    # Separate TS config for Electron
│   └── dist/            # Compiled JS (after `compile:electron`)
├── prisma/
│   └── schema.prisma    # Database schema (20+ models)
├── scripts/
│   ├── seed.ts          # Database seeding script
│   └── build-windows-portable.js  # Build Windows ZIP without Wine
├── src/
│   ├── app/
│   │   ├── api/         # Next.js API routes (auth, journals, reports, etc.)
│   │   ├── layout.tsx   # Root layout
│   │   └── page.tsx     # Main page (auth gating + view switcher)
│   ├── components/
│   │   ├── erp/         # ERP-specific components (AppShell, KpiCard, etc.)
│   │   │   └── views/   # View modules (Dashboard, Journals, Reports, etc.)
│   │   └── ui/          # shadcn/ui primitives
│   └── lib/
│       ├── api.ts       # API helpers (session-aware)
│       ├── auth.ts      # Session-based auth
│       ├── db.ts         # Prisma client singleton
│       ├── format.ts    # Money/date formatting
│       └── erp-store.ts # Zustand store for view state
├── electron-builder.win.yml  # Windows packaging config
├── electron-builder.mac.yml # macOS packaging config
├── package.json             # Scripts + dependencies + Linux build config
└── BUILD.md             # This file
```
