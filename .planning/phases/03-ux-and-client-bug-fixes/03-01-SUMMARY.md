---
phase: 03-ux-and-client-bug-fixes
plan: 01
subsystem: ui
tags: [react, spacetimedb, accountpage, recovery-code, classroom]

# Dependency graph
requires:
  - phase: 01-security-hardening
    provides: "recovery_code_results public table populated by getMyRecoveryCode reducer (SEC-03)"
provides:
  - AccountPage without classroom section (UX-01)
  - Single-fire recovery code fetch in App.tsx on player connect (UX-05)
affects: [03-ux-and-client-bug-fixes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "hasFetchedRecoveryCodeRef pattern: useRef boolean gate to prevent duplicate reducer calls across re-renders"
    - "Single-fire session hydration: fire reducer once per identity change in App.tsx, child pages only read from table"

key-files:
  created: []
  modified:
    - client/src/pages/AccountPage.tsx
    - client/src/App.tsx

key-decisions:
  - "Recovery code hydration moved to App.tsx single-fire pattern — AccountPage now only reads recovery_code_results via useTable; getMyRecoveryCode() removed from AccountPage entirely including the post-regenerate refresh call (SpacetimeDB pushes the updated row automatically after regenerateRecoveryKey)"
  - "onEnterClassroom prop fully removed from AccountPage Props interface and App.tsx call site — classrooms tab (ClassroomsPage) is the canonical classroom entry point"

patterns-established:
  - "App-level one-shot hydration: reducers that populate result tables should be called once in App.tsx on connect, not on every child page mount"

requirements-completed: [UX-01, UX-05]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 03 Plan 01: AccountPage Cleanup Summary

**AccountPage classroom section removed and recovery code fetch moved to single-fire App.tsx session hydration using hasFetchedRecoveryCodeRef**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T22:11:26Z
- **Completed:** 2026-03-14T22:14:16Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- Removed entire classroom list section from AccountPage (hooks, derived state, JSX) — no more classroom-related code in AccountPage
- Removed `onEnterClassroom` prop from AccountPage Props interface and App.tsx call site
- Moved `getMyRecoveryCode()` call from per-mount AccountPage useEffect to single-fire App.tsx useEffect guarded by `hasFetchedRecoveryCodeRef`
- TypeScript compiles clean, all 37 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove classroom section from AccountPage (UX-01)** - `b75d169` (feat)
2. **Task 2: Move recovery code fetch to App.tsx (UX-05)** - `a2fed69` (feat)

**Plan metadata:** (docs commit pending)

## Files Created/Modified
- `client/src/pages/AccountPage.tsx` - Removed: `onEnterClassroom` prop, `classrooms`/`classroomMembers`/`leaveClassroom` hooks, `ClassroomEntry` type, `myClassroomList`/`leavingId`/`handleLeaveClassroom` derived state, classroom JSX block, `getMyRecoveryCode` hook and on-mount useEffect
- `client/src/App.tsx` - Added: `useSTDBReducer` import, `reducers` import, `hasFetchedRecoveryCodeRef`, `getMyRecoveryCode` reducer hook, single-fire useEffect for session hydration; removed `onEnterClassroom` from AccountPage call site

## Decisions Made
- Recovery code hydration moved to App.tsx single-fire pattern — AccountPage now only reads `recovery_code_results` via `useTable`. The post-regenerate `getMyRecoveryCode()` call was also removed from `handleGenerateRecoveryKey` because SpacetimeDB automatically pushes the updated row to subscribed clients after `regenerateRecoveryKey` runs.
- `onEnterClassroom` prop fully removed from AccountPage — users navigate to classrooms via the dedicated Classrooms tab.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- Phase 03-01 complete; AccountPage is clean with no classroom section and no per-mount recovery code calls
- Recovery code display will work correctly: App.tsx hydrates once on connect, AccountPage reads from the table
- Ready to proceed to next plan in Phase 03

---
*Phase: 03-ux-and-client-bug-fixes*
*Completed: 2026-03-14*
