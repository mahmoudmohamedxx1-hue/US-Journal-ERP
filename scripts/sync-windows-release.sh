#!/bin/bash
# Rebuild Windows portable ZIP and upload it to the latest GitHub release.
# Run this script after ANY change that affects the Windows build.
#
# Usage: bash scripts/sync-windows-release.sh [version]
#   version defaults to "v1.0.0" — pass "v1.1.0" etc. for new versions.
#
# Required env var:
#   GITHUB_TOKEN — a Personal Access Token with `repo` scope
#   (For workflow scope, you also need to update .github/workflows/* via web UI.)

set -e

cd /home/z/my-project

VERSION="${1:-v1.0.0}"
TOKEN="${GITHUB_TOKEN:?Need to set GITHUB_TOKEN env var}"
REPO="mahmoudmohamedxx1-hue/US-Journal-ERP"
ZIP_PATH="download/USJournalERP-Windows-Portable.zip"

echo "================================================"
echo "  US Journal ERP — Windows Release Sync"
echo "  Version: $VERSION"
echo "================================================"
echo ""

# 1. Build Next.js standalone (if missing or stale)
if [ ! -f .next/standalone/server.js ] || [ "$FORCE_REBUILD" = "1" ]; then
  echo "▶ Building Next.js standalone..."
  bun run build 2>&1 | tail -3
fi

# 2. Compile Electron (if missing or stale)
if [ ! -f electron/dist/main.js ] || [ "$FORCE_REBUILD" = "1" ]; then
  echo "▶ Compiling Electron main process..."
  npx tsc -p electron/tsconfig.json
fi

# 3. Download Windows Electron binary (if missing)
if [ ! -f node_modules/electron/dist/electron.exe ]; then
  echo "▶ Downloading Windows Electron binary..."
  ELECTRON_INSTALL_PLATFORM=win32 ELECTRON_INSTALL_ARCH=x64 node node_modules/electron/install.js
fi

# 4. Build the Windows portable ZIP
echo "▶ Building Windows portable ZIP..."
node scripts/build-windows-portable.js 2>&1 | tail -10

if [ ! -f "$ZIP_PATH" ]; then
  echo "✗ ZIP file not created"
  exit 1
fi

SIZE=$(du -h "$ZIP_PATH" | cut -f1)
echo "✓ ZIP built: $ZIP_PATH ($SIZE)"
echo ""

# 5. Find the release ID (create if doesn't exist)
echo "▶ Looking up GitHub release $VERSION..."
RELEASE_JSON=$(curl -s -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/$REPO/releases/tags/$VERSION")

RELEASE_ID=$(echo "$RELEASE_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id', ''))" 2>/dev/null || echo "")

if [ -z "$RELEASE_ID" ]; then
  echo "▶ Release $VERSION not found — creating..."
  RELEASE_JSON=$(curl -s -X POST -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/repos/$REPO/releases \
    -d "{\"tag_name\":\"$VERSION\",\"target_commitish\":\"main\",\"name\":\"US Journal ERP $VERSION - Windows Portable\",\"body\":\"## US Journal ERP $VERSION - Windows Portable Edition\\n\\n### Download\\n\\n1. Download \`USJournalERP-Windows-Portable.zip\` below\\n2. Extract the ZIP to any folder (Desktop, Documents, etc.)\\n3. Double-click **Start US Journal ERP.bat**\\n4. The app window opens - wait ~5 seconds for the server to start\\n\\n### Demo Login Credentials (after seeding)\\n\\n| Role | Email | Password |\\n|------|-------|----------|\\n| Administrator | admin@usjournal.test | Admin@2026 |\\n| Controller | controller@usjournal.test | Control@2026 |\\n| Approver | approver@usjournal.test | Approve@2026 |\\n| Accountant | accountant@usjournal.test | Accounts@2026 |\\n| Auditor | auditor@usjournal.test | Audit@2026 |\\n| Viewer | viewer@usjournal.test | View@2026 |\\n\\n### System Requirements\\n\\n- Windows 10 or later (64-bit)\\n- 1 GB free RAM\\n- 500 MB free disk space\",\"draft\":false,\"prerelease\":false}")
  RELEASE_ID=$(echo "$RELEASE_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id', ''))")
  echo "✓ Created release ID: $RELEASE_ID"
else
  echo "✓ Found existing release ID: $RELEASE_ID"
fi

# 6. Delete existing asset (if any) — GitHub doesn't allow overwriting
echo "▶ Checking for existing ZIP asset..."
ASSETS=$(curl -s -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/$REPO/releases/$RELEASE_ID/assets")
ASSET_ID=$(echo "$ASSETS" | python3 -c "
import json, sys
assets = json.load(sys.stdin)
for a in assets:
    if a['name'] == 'USJournalERP-Windows-Portable.zip':
        print(a['id'])
        break
" 2>/dev/null || echo "")

if [ -n "$ASSET_ID" ]; then
  echo "▶ Deleting old ZIP asset (ID: $ASSET_ID)..."
  curl -s -X DELETE -H "Authorization: token $TOKEN" \
    "https://api.github.com/repos/$REPO/releases/assets/$ASSET_ID" > /dev/null
  echo "✓ Deleted old asset"
fi

# 7. Upload new ZIP
echo "▶ Uploading new ZIP ($SIZE)..."
UPLOAD_RESULT=$(curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary @"$ZIP_PATH" \
  "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=USJournalERP-Windows-Portable.zip")

DOWNLOAD_URL=$(echo "$UPLOAD_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('browser_download_url', d.get('message', 'ERROR')))")
echo "✓ Upload complete"
echo ""
echo "================================================"
echo "  ✓ Windows ZIP $VERSION is now live"
echo "  Download URL: $DOWNLOAD_URL"
echo "================================================"
