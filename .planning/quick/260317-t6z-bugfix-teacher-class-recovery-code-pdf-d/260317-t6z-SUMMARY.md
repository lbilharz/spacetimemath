---
phase: quick-260317-t6z
plan: "01"
type: quick-bugfix
subsystem: classroom
tags: [bugfix, print, pdf, recovery-codes, error-handling]
dependency_graph:
  requires: []
  provides: [T6Z-01]
  affects: [ClassroomPage]
tech_stack:
  added: []
  patterns: [two-phase-poll, error-state-feedback]
key_files:
  created: []
  modified:
    - client/src/pages/ClassroomPage.tsx
    - client/src/locales/en/translation.json
    - client/src/locales/de/translation.json
decisions:
  - "Two-phase stale-rows poll: wait for count→0 then wait for new rows, avoids returning old data on second click"
  - "printError placed after button header div so it appears below the row of buttons without breaking layout"
  - "Moved win=null guard before the first await so popup-blocked path short-circuits before the reducer call"
metrics:
  duration: "253s"
  completed: "2026-03-17"
  tasks_completed: 1
  files_changed: 3
---

# Quick 260317-t6z: Fix Teacher Print Login Cards PDF

**One-liner:** Fixed three silent failure modes in handlePrintAll — popup-blocked, no-recovery-keys, and stale-rows race — by adding printError state, a two-phase poll, and inline error display.

## Tasks Completed

| Task | Description | Commit |
| ---- | ----------- | ------ |
| 1 | Add error state and fix silent failure paths in handlePrintAll | 9e0e94a |

## What Was Built

### Changes to `client/src/pages/ClassroomPage.tsx`

**New state:** `printError: string | null` — cleared at the start of each `handlePrintAll` call.

**Popup-blocked path:** `window.open()` is still called synchronously before any `await`. If it returns `null`, `setPrintError(t('classroom.printPopupBlocked'))` is called and the function returns immediately — no more silent failure.

**Stale-rows guard (two-phase poll):**
- Phase 1: if `prevCount > 0` (rows from a previous call are still present), wait up to 2 s for the count to drop to 0 before proceeding.
- Phase 2: wait up to 5 s for new rows to arrive.
- This eliminates the race where a second click returns the old PDF.

**Timeout path:** When `resultRows.length === 0` after the 5 s deadline, `setPrintError(t('classroom.printNoKeys'))` is set and the blank popup is closed — no more silent blank window.

**Error display:** `{isTeacher && printError && <p className="text-xs text-error mt-1">{printError}</p>}` rendered directly below the header button row, visible to the teacher immediately.

### Locale keys added (EN + DE)

- `classroom.printPopupBlocked` — popup-blocked message
- `classroom.printNoKeys` — no keys available message

## Verification

- `npm test -- --run`: 44/44 tests passed
- `npm run build`: TypeScript build clean, 0 errors

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `client/src/pages/ClassroomPage.tsx` — modified, confirmed present
- `client/src/locales/en/translation.json` — modified, confirmed present
- `client/src/locales/de/translation.json` — modified, confirmed present
- Commit `9e0e94a` — confirmed in git log
