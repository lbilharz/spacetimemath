---
phase: 08-tokenized-fetch-for-sensitive-one-shot-results
plan: 01
subsystem: ui
tags: [react, spacetimedb, subscription, identity, security]

# Dependency graph
requires:
  - phase: 05-account-recovery-and-classroom-code-management
    provides: restore_results, recovery_code_results, class_recovery_results tables and reducers
provides:
  - identity-scoped useTable subscriptions for all three sensitive result tables
affects: [AccountPage, RegisterPage, ClassroomPage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSpacetimeDB() hook to get caller identity, then .where(r => r.field.eq(identity)) for server-side scoped subscriptions"

key-files:
  created: []
  modified:
    - client/src/pages/AccountPage.tsx
    - client/src/pages/RegisterPage.tsx
    - client/src/pages/ClassroomPage.tsx

key-decisions:
  - "Identity-guard fallback pattern: identity ? tables.x.where(...) : tables.x — unscoped before identity resolves, but rows are always identity-owned anyway"
  - "classroomId filter preserved in ClassroomPage after removing teacherIdentity filter — a teacher can have multiple classrooms, classroomId still needed"
  - "myRecoveryKey derivation changed from .find(r => r.owner.toHexString() === myIdentityHex) to [0] — subscription is server-scoped so the array contains at most one row"

patterns-established:
  - "Server-scoped subscription pattern: useSpacetimeDB identity + .where(r => r.field.eq(identity)) closes cross-client data leak without schema changes"

requirements-completed: [SCOPE-01, SCOPE-02, SCOPE-03]

# Metrics
duration: 5min
completed: 2026-03-15
---

# Phase 8 Plan 1: Tokenized Fetch — Subscription Scoping Summary

**SpacetimeDB .where(r => r.field.eq(identity)) applied to all three sensitive result tables, eliminating cross-client data leaks server-side**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-15T22:30:00Z
- **Completed:** 2026-03-15T22:31:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Scoped `recovery_code_results` subscription in AccountPage to the caller's identity via `r.owner.eq(identity)`
- Scoped `restore_results` subscription in RegisterPage to the caller's identity via `r.caller.eq(identity)`
- Scoped `class_recovery_results` subscription in ClassroomPage to the teacher's identity via `r.teacherIdentity.eq(identity)` (camelCase, confirmed from module bindings)
- Removed now-redundant client-side identity filters where the server WHERE clause already enforces ownership
- TypeScript compiles clean, all 42 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Scope recovery_code_results in AccountPage** - `f10ab7b` (feat)
2. **Task 2: Scope restore_results and class_recovery_results** - `3e89506` (feat)

## Files Created/Modified

- `client/src/pages/AccountPage.tsx` — Added useSpacetimeDB, scoped recovery_code_results, simplified myRecoveryKey to [0]
- `client/src/pages/RegisterPage.tsx` — Added useSpacetimeDB, scoped restore_results
- `client/src/pages/ClassroomPage.tsx` — Added useSpacetimeDB, scoped class_recovery_results, removed teacherIdentity filter from myClassRecoveryCodes and handlePrintAll polling loop (classroomId filter preserved)

## Decisions Made

- Identity-guard fallback pattern (`identity ? tables.x.where(...) : tables.x`) is correct — pre-identity connections get an unscoped subscription, but that subscription will only ever see their own rows anyway.
- `myRecoveryKey` simplified from `.find(r => r.owner.toHexString() === myIdentityHex)` to `[0]` since the subscription is now server-scoped to the caller.
- `classroomId` filter preserved in ClassroomPage even after removing `teacherIdentity` filter — a teacher may have codes for multiple classrooms in the subscription.

## Deviations from Plan

Minor extension of scope: removed redundant `teacherIdentity` identity filter in `handlePrintAll` polling loop (line 269 of ClassroomPage) in addition to the `myClassRecoveryCodes` derivation. The plan explicitly called for removing filters on `classRecoveryResults`. Both removals are consistent with server-scoped subscription, and the classroomId filter that remains is still necessary.

**Total deviations:** None structural — one minor extra cleanup within the plan's stated intent.

## Issues Encountered

None — all changes applied cleanly on first attempt.

## Next Phase Readiness

- All three sensitive result table subscriptions are server-scoped (SCOPE-01, SCOPE-02, SCOPE-03 satisfied)
- Remaining Phase 8 plans can proceed: consume-after-read pattern (if planned)

## Self-Check: PASSED

All files verified present. Both task commits verified in git history.

---
*Phase: 08-tokenized-fetch-for-sensitive-one-shot-results*
*Completed: 2026-03-15*
