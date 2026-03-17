---
phase: quick-260317-acs
plan: 01
subsystem: ui
tags: [react, splash, localStorage, session-restore, ux]

requires: []
provides:
  - Credentials-aware splash initialization in App.tsx — returning users skip the 2.5s timer
affects: [App.tsx, splash behavior]

tech-stack:
  added: []
  patterns:
    - "Module-level synchronous localStorage check to initialize React state before first render"

key-files:
  created: []
  modified:
    - client/src/App.tsx

key-decisions:
  - "isSessionRestore computed at module level (outside component) so it runs exactly once synchronously — no useRef or useEffect needed"
  - "CREDS_KEY defined locally in App.tsx (not imported from main.tsx) — read-only check, no sharing of the write path"
  - "Existing useEffect timer (2500ms) left unchanged — it becomes a no-op for returning users (state already true) and still fires correctly for new users"

patterns-established:
  - "Module-level synchronous localStorage init: const flag = (() => { try { return !!localStorage.getItem(KEY); } catch { return false; } })(); then useState(flag)"

requirements-completed: [QUICK-ACS]

duration: 3min
completed: 2026-03-17
---

# Quick Task 260317-acs: Session Restore Splash Fix Summary

**Credentials-aware splash initialization: returning users skip the 2.5s branded timer, waiting only for WebSocket connect and player data instead.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-17T07:26:00Z
- **Completed:** 2026-03-17T07:29:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `hasSavedCredentials()` module-level helper for a synchronous localStorage read before first render
- Changed `splashDone` initial state from `false` to `isSessionRestore` so returning users bypass the hard timer
- New users still get the full 2.5s branded splash; existing second guard (`!isActive && !effectivePlayer`) remains untouched

## Task Commits

1. **Task 1: Skip splash timer for returning users with saved credentials** - `f50c7ef` (feat)

## Files Created/Modified

- `client/src/App.tsx` - Added module-level `hasSavedCredentials()` helper and `isSessionRestore` flag; changed `useState(false)` to `useState(isSessionRestore)` for `splashDone`

## Decisions Made

- CREDS_KEY defined locally (not imported from main.tsx) — the helper is a self-contained read-only check; sharing would couple the write path unnecessarily
- Module-level evaluation (not inside the component) ensures the check runs exactly once at module load, not on every render

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Session restore UX is now instant for returning users. No follow-up needed.

## Self-Check

- [x] `client/src/App.tsx` modified with module-level helper and updated useState initializer
- [x] Commit `f50c7ef` exists

## Self-Check: PASSED

---
*Quick task: quick-260317-acs*
*Completed: 2026-03-17*
