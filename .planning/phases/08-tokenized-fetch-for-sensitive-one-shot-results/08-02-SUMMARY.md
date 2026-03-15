---
phase: 08-tokenized-fetch-for-sensitive-one-shot-results
plan: 02
subsystem: auth
tags: [spacetimedb, rust, react, typescript, security, consume-after-read]

# Dependency graph
requires:
  - phase: 08-01
    provides: identity-scoped restore_results subscription in RegisterPage

provides:
  - consume_restore_result reducer in security.rs (CONSUME-01)
  - Generated TS binding consume_restore_result_reducer.ts
  - RegisterPage calls consumeRestoreResult() after localStorage write, before reload

affects:
  - restore_results table exposure window (reduced from disconnect-lifetime to seconds)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - consume-after-read: delete sensitive result row immediately after client processes it
    - best-effort reducer call: wrapped in try/catch so failure never blocks the UX path

key-files:
  created:
    - client/src/module_bindings/consume_restore_result_reducer.ts
  modified:
    - server/src/security.rs
    - client/src/module_bindings/index.ts
    - client/src/module_bindings/types/reducers.ts
    - client/src/pages/RegisterPage.tsx

key-decisions:
  - "consume_restore_result is idempotent — no error if row already gone (identity_disconnected is backstop)"
  - "consume call is best-effort (try/catch) — restore UX completes even if consume reducer fails"

patterns-established:
  - "Consume-after-read: sensitive one-shot result rows deleted server-side immediately after client reads them"

requirements-completed: [CONSUME-01]

# Metrics
duration: 10min
completed: 2026-03-15
---

# Phase 8 Plan 02: Consume-After-Read for restore_results Summary

**consume_restore_result server reducer deployed to maincloud; RegisterPage deletes the restore_results row immediately after writing credentials to localStorage, shrinking exposure window from disconnect-lifetime to seconds**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-15T22:33:00Z
- **Completed:** 2026-03-15T22:36:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `consume_restore_result` reducer to `server/src/security.rs` (CONSUME-01) — idempotent delete of the caller's restore_results row
- Deployed WASM to maincloud and regenerated TS bindings — `consume_restore_result_reducer.ts` auto-generated
- Wired `consumeRestoreResult()` call in RegisterPage between `localStorage.setItem` and `window.location.reload()`, wrapped in try/catch

## Task Commits

Each task was committed atomically:

1. **Task 1: Add consume_restore_result reducer and deploy** - `68902d6` (feat)
2. **Task 2: Wire consumeRestoreResult call in RegisterPage** - `148c581` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `server/src/security.rs` - Added `consume_restore_result` reducer after `restore_account`
- `client/src/module_bindings/consume_restore_result_reducer.ts` - Auto-generated TS binding (new file)
- `client/src/module_bindings/index.ts` - Updated by codegen to include consumeRestoreResult
- `client/src/module_bindings/types/reducers.ts` - Updated by codegen
- `client/src/pages/RegisterPage.tsx` - Added useSTDBReducer hook + consume call in handleRestore

## Decisions Made
- consume_restore_result has no parameter (no lookup needed) — simpler than use_transfer_code pattern; idempotent (no error if row already gone)
- Consume call is best-effort (try/catch) so a reducer failure or network blip never blocks the restore UX; `identity_disconnected` handler remains as backstop

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Integration test `triggers tier unlock after class sprint ends` failed during `make deploy` with a 10-second waitFor timeout — confirmed pre-existing flaky test unrelated to this plan's changes (no new server table or logic affected class sprint scoring). Unit tests (42 tests) all pass.

## Next Phase Readiness
- Phase 8 complete — CONSUME-01 satisfied
- restore_results exposure window is now seconds (consume-after-read) with identity_disconnected as backstop
- No blockers for v1.0 milestone

## Self-Check: PASSED
- FOUND: server/src/security.rs
- FOUND: client/src/module_bindings/consume_restore_result_reducer.ts
- FOUND: client/src/pages/RegisterPage.tsx
- FOUND: commit 68902d6 (feat: add reducer + deploy)
- FOUND: commit 148c581 (feat: wire consume call in RegisterPage)

---
*Phase: 08-tokenized-fetch-for-sensitive-one-shot-results*
*Completed: 2026-03-15*
