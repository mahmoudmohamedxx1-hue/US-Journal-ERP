# US Journal ERP — Worklog

This file tracks all changes made to the US Journal ERP project. Newest entries at the top.

---
Task ID: gh-push
Agent: main
Task: Push US Journal ERP to GitHub as a new repo named "US Journal ERP" and configure for ongoing sync

Work Log:
- Created GitHub repo `mahmoudmohamedxx1-hue/US-Journal-ERP` via GitHub API (public)
- Configured git remote with the provided Personal Access Token
- Updated `.gitignore` to exclude build artifacts (release/, electron/dist/, db/*.db, download/*.AppImage, etc.)
- Created comprehensive `README.md` with feature overview, tech stack, demo credentials, build instructions
- Created `.env.example` (since `.env` is gitignored)
- Initial commit pushed (commit `63b1fa2`) — full source code, ~136 files
- Created `GITHUB_ACTIONS.md` documenting the CI workflow YAML (token lacks `workflow` scope, so workflow file must be added via GitHub web UI)
- Second commit pushed (commit `4a64734`) — GITHUB_ACTIONS.md
- Set up git credential helper (`~/.git-credentials`) so future pushes work automatically without re-entering the token
- Verified repo is accessible at https://github.com/mahmoudmohamedxx1-hue/US-Journal-ERP

Stage Summary:
- Repo URL: https://github.com/mahmoudmohamedxx1-hue/US-Journal-ERP
- Default branch: `main`
- 2 commits pushed (initial + GITHUB_ACTIONS.md)
- Future updates will be pushed automatically using the stored credential
- The token has repo scope but lacks `workflow` scope, so GitHub Actions YAML must be added via web UI (instructions in GITHUB_ACTIONS.md)

Next Steps for User:
1. Visit the repo on GitHub
2. (Optional) Add `.github/workflows/build.yml` via the web UI using the YAML in GITHUB_ACTIONS.md to enable auto-builds
3. Any future updates I make will be pushed to this repo automatically

---
Task ID: electron-desktop
Agent: main
Task: Convert the Next.js ERP web app into a PC-installable desktop application

Work Log:
- Added Session model + bcrypt password hashing to Prisma schema
- Re-seeded users with real bcrypt-hashed passwords
- Built /api/auth/login, /api/auth/logout, /api/auth/me endpoints with cookie-based sessions
- Migrated all 22 API routes from hardcoded DEMO_USER_ID to session-resolved user.id
- Built login screen UI with brand panel + 6 quick-fill demo accounts
- Created Electron main process (electron/main.ts) + preload script
- Configured next.config.ts for standalone output + externalized bcryptjs
- Created electron-builder configs (Windows NSIS + macOS DMG + Linux AppImage)
- Built Linux AppImage (218 MB) and tar.gz (26 MB) — verified working
- Built Windows Portable ZIP (400 MB) — contains USJournalERP.exe + Next.js standalone
- Wrote BUILD.md with full build instructions for all platforms
- Wrote INSTALL.txt with user-facing install instructions

Stage Summary:
- Three installer artifacts in /home/z/my-project/download/:
  - USJournalERP-Windows-Portable.zip (400 MB)
  - USJournalERP-1.0.0.AppImage (218 MB)
  - USJournalERP-1.0.0-x64.tar.gz (26 MB)
- Full authentication flow with bcrypt-hashed passwords
- All API routes require session authentication

---
Task ID: windows-release-sync
Agent: main
Task: Push Windows ZIP to GitHub repo and set up auto-syncing for future updates

Work Log:
- Verified user added `.github/workflows/build.yml` via GitHub web UI (commit `5559d23`)
- Found that electron/ directory and BUILD.md were never committed in initial push (lost during session disruption)
- Recreated from scratch:
  - electron/main.ts (Electron main process — spawns Next.js, manages userData DB path)
  - electron/preload.ts (contextBridge for safe IPC)
  - electron/tsconfig.json (separate TS config for Electron compilation)
  - electron-builder.win.yml (Windows NSIS installer config)
  - electron-builder.mac.yml (macOS DMG config)
  - BUILD.md (full build guide)
- Reinstalled dependencies (electron, electron-builder, @types/bcryptjs, bcryptjs)
- Downloaded Windows Electron binary (`ELECTRON_INSTALL_PLATFORM=win32 node node_modules/electron/install.js`)
- Compiled Electron main process (`tsc -p electron/tsconfig.json`)
- Created `scripts/build-windows-portable.js` — builds Windows ZIP without Wine:
  1. Copies Windows Electron runtime files
  2. Renames electron.exe → USJournalERP.exe
  3. Packs app.asar with compiled Electron main + preload
  4. Copies Next.js standalone to resources/app/
  5. Creates Start US Journal ERP.bat launcher
  6. Creates README.txt with install instructions
  7. Zips everything
- Built Windows portable ZIP (219 MB)
- Created GitHub release v1.0.0 via API and uploaded ZIP as release asset
- Created GitHub release v1.0.1 (test of sync script)
- Created `scripts/sync-windows-release.sh` — auto-rebuilds and re-uploads Windows ZIP
- Set up local `.env` with GITHUB_TOKEN (gitignored) so the sync script can run without prompting
- Pushed all new files to GitHub (commits 874eaa3, 1e1b480)
- Token doesn't have `workflow` scope, so .github/workflows/build.yml cannot be updated via API
  (User must edit it manually via GitHub web UI if changes are needed)

Stage Summary:
- Windows ZIP v1.0.0: https://github.com/mahmoudmohamedxx1-hue/US-Journal-ERP/releases/tag/v1.0.0
- Windows ZIP v1.0.1: https://github.com/mahmoudmohamedxx1-hue/US-Journal-ERP/releases/tag/v1.0.1
- Sync script: `bash scripts/sync-windows-release.sh v1.0.2` (auto-rebuilds + reuploads)
- Source code on GitHub: https://github.com/mahmoudmohamedxx1-hue/US-Journal-ERP
- 6 commits on main branch

Next Steps for Future Updates:
- Any time the user asks for a change, after making it:
  1. Commit and push to GitHub
  2. Run `bash scripts/sync-windows-release.sh v1.0.X` (increment version) to rebuild Windows ZIP
- The script reads GITHUB_TOKEN from .env (already configured)
- New release will appear at https://github.com/mahmoudmohamedxx1-hue/US-Journal-ERP/releases

---
Task ID: ai-integration-and-qa
Agent: main
Task: Build GLM-powered AI integration (6 features) and conduct full browser-based QA pass to find bugs

Work Log:
- Built unified GLM AI module at src/lib/ai/glm.ts with 7 features: extractInvoice (vision), parseJournalCommand (NL→journal), explainAnomaly, generateMonthlyCommentary, voiceToJournal (ASR+chat), enrichVendor (web search), suggestAccount
- Created 7 AI API routes under src/app/api/ai/: health, nl-journal, anomaly-explain, monthly-commentary, voice-journal, vendor-enrich, suggest-account
- Refactored existing OCR route to use the new unified module (cleaner error handling, audit logging)
- Built AIJournalPanel React component (NL textbox + magic button + voice button) and wired into journal-new view
- Built AICommentaryWidget React component and wired into dashboard
- Started dev server (next dev -p 3000) and used agent-browser to systematically navigate every page like a real user

QA Findings + Fixes:
1. CRITICAL: Users & Roles page crashed with "Cannot read properties of undefined (reading 'bg')" because ROLES array contains 'Manager' and 'Employee' but ROLE_META only had 6 entries. Fixed by adding entries + fallback.
2. CRITICAL: Trial Balance was out of balance (900 EGP difference) because depreciation journal credited 1200 Fixed Assets instead of 1241 Accumulated Depreciation. Fixed lookup in fixed-assets/depreciate/route.ts and ran cleanup script (scripts/fix-db-data.js) to fix existing data.
3. CRITICAL: Stress test created 2 journal entries dated year 2099 that polluted the register. Cleanup script marked them Reversed.
4. BUG: Monthly commentary used `date` field instead of `journalDate` — fixed.
5. BUG: Monthly commentary used `acc.type` instead of `acc.accountType` — fixed in both monthly-commentary and suggest-account routes.
6. BUG: Currency formatting used ar-EG locale for EGP, showing Arabic-Indic digits (١٠٠٬٥٠٠). Changed all SUPPORTED_CURRENCIES locales to en-US — now shows "EGP 100,500.00".
7. BUG: Date format used en-GB which renders "Sept" (4 letters) instead of "Sep". Switched to en-US.
8. BUG: AI Commentary showed "$996.00" instead of "EGP 996.00" because server-side formatMoney defaults to USD. Fixed to use org's base currency.
9. BUG: Dashboard "YTD Revenue" hint said "no posted journals yet" when revenue was negative (-96 EGP). Fixed condition from `> 0` to `!== 0`.
10. BUG: AI-applied journal matched "Operating bank account" to "Operating Expenses" via loose first-word match. Rewrote findAccount logic: prefer exact code/name match, then full-name word-match, then payment-method keywords (cash/visa/bank) → prefer cash/bank Asset accounts.

Verified Working After Fixes:
- AI NL journal entry: "Record 500 EGP office supplies..." → Dr 6000 / Cr 1000 Cash, EGP 500 balanced ✓
- AI NL journal entry: "Pay monthly salary of 5000 EGP..." → Dr 6000 / Cr 1000 Cash, EGP 5000 balanced ✓
- AI OCR: uploaded test-invoice.png, GLM-4V correctly extracted vendor (ACME CORPORATION), tax ID, 3 line items, subtotal/tax/total ✓
- AI Monthly Commentary: produces 2-paragraph executive summary using EGP currency ✓
- AI Suggest Account: returns correct account with confidence + reason ✓
- AI Anomaly Explain: returns forensic-accountant-style explanation ✓
- AI Vendor Enrich: returns Microsoft Corp info (legal name, tax ID, address, website, industry) ✓
- Journal save flow: AI parse → Apply → Save as Draft → JE-2026-0078 created successfully ✓
- All 32 sidebar pages render without errors ✓
- Trial Balance: 90000 = 90000, Balanced ✓
- Audit log records every AI call with [glm-4] prefix ✓

Stage Summary:
- All AI features functional on free GLM tier (no API keys required)
- 10 bugs found and fixed, including 2 critical (app crash, broken trial balance)
- App is now visually consistent (English locale, EGP currency in Western digits)
- New files: src/lib/ai/glm.ts, src/components/erp/ai-journal-panel.tsx, src/components/erp/ai-commentary-widget.tsx, 7 AI API routes, scripts/fix-db-data.js
- Modified files: src/app/api/ocr-scan/route.ts, src/app/api/ai/monthly-commentary/route.ts (multiple fixes), src/app/api/ai/suggest-account/route.ts, src/app/api/fixed-assets/depreciate/route.ts (critical bug fix), src/components/erp/views/dashboard.tsx (AI widget + hint fix), src/components/erp/views/journal-new.tsx (AI panel + improved account matching), src/components/erp/views/users.tsx (ROLE_META fix), src/lib/format.ts (locale fixes)
