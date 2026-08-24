# GitHub Actions Workflow — Auto-build Desktop Installers

The provided GitHub token doesn't have `workflow` scope, so we can't push this
file as a GitHub Action directly. To enable auto-builds on every push,
copy the YAML below into a new file at:

`.github/workflows/build.yml`

You can do this via the GitHub UI (web editor), which doesn't require
the `workflow` scope on your token.

---

```yaml
name: Build Desktop Installers

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-linux:
    name: Build Linux AppImage
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: bun install

      - name: Initialize database
        run: bun run db:push

      - name: Build Next.js standalone
        run: bun run build

      - name: Compile Electron main process
        run: bun run compile:electron

      - name: Build Linux AppImage
        run: ./node_modules/.bin/electron-builder --linux

      - name: Upload AppImage artifact
        uses: actions/upload-artifact@v4
        with:
          name: USJournalERP-Linux-AppImage
          path: |
            release/*.AppImage
            release/*.tar.gz
          if-no-files-found: error

  build-windows:
    name: Build Windows Installer
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: bun install

      - name: Initialize database
        run: bun run db:push

      - name: Build Next.js standalone
        run: bun run build

      - name: Compile Electron main process
        run: bun run compile:electron

      - name: Build Windows NSIS installer
        run: ./node_modules/.bin/electron-builder --win --config electron-builder.win.yml

      - name: Upload Windows installer
        uses: actions/upload-artifact@v4
        with:
          name: USJournalERP-Windows-Setup
          path: |
            release/*.exe
          if-no-files-found: error

  build-macos:
    name: Build macOS DMG
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: bun install

      - name: Initialize database
        run: bun run db:push

      - name: Build Next.js standalone
        run: bun run build

      - name: Compile Electron main process
        run: bun run compile:electron

      - name: Build macOS DMG
        run: ./node_modules/.bin/electron-builder --mac --config electron-builder.mac.yml

      - name: Upload macOS DMG
        uses: actions/upload-artifact@v4
        with:
          name: USJournalERP-macOS-DMG
          path: |
            release/*.dmg
          if-no-files-found: error
```

## What this workflow does

Every time you push to `main`, this workflow builds installers for all three platforms:
- **Linux** — `USJournalERP-1.0.0.AppImage` (single-file portable app)
- **Windows** — `USJournalERP-Setup-1.0.0.exe` (NSIS installer)
- **macOS** — `USJournalERP-1.0.0.dmg` (DMG image)

The installers are uploaded as GitHub Actions artifacts — go to the
"Actions" tab on the repo, click the latest run, and download each
platform's installer.

## How to enable

1. Go to https://github.com/mahmoudmohamedxx1-hue/US-Journal-ERP
2. Click "Add file" → "Create new file"
3. Name it: `.github/workflows/build.yml`
4. Copy the YAML above into the editor
5. Click "Commit changes"

The first build will run automatically on the next push.
