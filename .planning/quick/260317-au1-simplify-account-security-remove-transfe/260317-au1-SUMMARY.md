---
phase: quick-260317-au1
plan: 01
subsystem: client/account-ux
tags: [account, recovery-key, transfer-code, locale, ux]
dependency_graph:
  requires: []
  provides: [simplified-account-security-ux]
  affects: [AccountPage, RegisterPage-restore-flow]
tech_stack:
  added: []
  patterns: [masked-key-reveal, always-visible-form]
key_files:
  created: []
  modified:
    - client/src/pages/AccountPage.tsx
    - client/src/locales/en/translation.json
    - client/src/locales/de/translation.json
decisions:
  - Transfer code server tables (transfer_codes, transfer_code_results, transfer_code_cleanup_schedule) and reducers left untouched on server — client simply stops calling them; no schema migration required
  - Recovery key masked by default with bullet chars (U+2022), not asterisks, for better visual density
  - Email form stays always visible after successful send (emailSent shows inline success note but form remains)
metrics:
  duration: ~2 min
  completed: 2026-03-17
---

# Phase quick-260317-au1 Plan 01: Simplify Account Security Summary

**One-liner:** Removed transfer code UI entirely and added masked-by-default recovery key reveal with always-present email form in AccountPage.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Remove transfer code from AccountPage, add masked key reveal | b1b4242 | client/src/pages/AccountPage.tsx |
| 2 | Update locale strings — remove transfer keys, add reveal/hide/resend, fix restoreDesc | 63bc790 | client/src/locales/en/translation.json, client/src/locales/de/translation.json |

## What Was Built

**AccountPage changes:**
- Removed all transfer code infrastructure: `useTable(tables.transfer_code_results)`, `createTransferCode` reducer, `cleanupCode` (useTransferCode) reducer, `generating`/`countdown`/`codeShownAt`/`transferCopied` state, both countdown `useEffect` hooks, `handleGenerateCode`/`handleCopyTransfer`/`fmtCountdown` functions, `TransferCodeResult` type import, and the entire transfer code JSX block including the divider
- Added `keyRevealed` state with toggle; recovery key shows `••••••••••••` by default, actual code when revealed
- Copy button is only rendered when `keyRevealed` is true, beside the Hide button
- Email input + send button section is always rendered when key exists — removed the `emailSent || myPlayer.recoveryEmailed` ternary that hid the form; success message shows inline while form stays visible

**Locale changes (EN + DE):**
- Removed keys: `transferCode`, `transferDesc`, `transferExpires`, `transferExpired`, `generateCode`, `newCode`
- Added keys: `reveal`, `hide`
- Updated: `recoveryDesc`, `logoutDesc` — both now mention only recovery key, not transfer code
- Updated: `register.restoreDesc`, `register.restorePlaceholder`, `register.restoreError` — references only 12-char recovery key

## Deviations from Plan

None — plan executed exactly as written.

The build error after Task 1 (TypeScript couldn't resolve `account.hide` / `account.reveal`) was the expected dependency between tasks — locale keys needed to exist before the build passed. Tasks were committed atomically after all changes were in place.

## Self-Check: PASSED

- `client/src/pages/AccountPage.tsx` — exists, modified
- `client/src/locales/en/translation.json` — exists, modified
- `client/src/locales/de/translation.json` — exists, modified
- Commit b1b4242 — exists (`feat(quick-260317-au1): remove transfer code...`)
- Commit 63bc790 — exists (`feat(quick-260317-au1): update locales...`)
- Build: passes (tsc + vite, 0 errors)
- Tests: 44/44 passed
- Pre-commit hook: passed on both commits
