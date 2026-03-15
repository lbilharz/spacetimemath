---
phase: 07-split-server-lib-rs-into-modules
plan: 01
subsystem: server
tags: [rust, wasm, spacetimedb, modules, visibility]

# Dependency graph
requires:
  - phase: 06-server-side-sprint-problem-sequencing
    provides: "Final lib.rs state before module extraction"
provides:
  - "lib.rs with pub(crate) visibility on all cross-module helpers and constants"
  - "Five empty stub module files that allow mod declarations to resolve"
  - "WASM build verified green — safe foundation for extraction in plans 07-02 through 07-04"
affects: [07-02, 07-03, 07-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pub(crate) visibility promotion as prerequisite step before code moves across module boundaries"
    - "Empty stub files to satisfy mod declarations before populating submodules"

key-files:
  created:
    - server/src/sprint.rs
    - server/src/auth.rs
    - server/src/security.rs
    - server/src/classroom.rs
    - server/src/gdpr.rs
  modified:
    - server/src/lib.rs

key-decisions:
  - "Visibility promotion done as isolated atomic step — compiler verifies changes before any code moves"
  - "Five mod declarations placed immediately after use spacetimedb line, before CONSTANTS section"

patterns-established:
  - "pub(crate) on helper fns and consts is the required pattern for anything called across submodule boundaries"

requirements-completed: [MOD-01]

# Metrics
duration: 5min
completed: 2026-03-15
---

# Phase 7 Plan 01: Split server lib.rs into modules — Preparation Summary

**lib.rs visibility-promoted and mod-declared; five empty Rust stub files compile cleanly to WASM — prerequisite for reducer extraction in plans 07-02 through 07-04**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-15T20:50:27Z
- **Completed:** 2026-03-15T20:52:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Promoted 9 helper functions (`get_player`, `make_code`, `make_recovery_code`, `factor_tier`, `pair_learning_tier`, `fnv_index`, `bootstrap_weight`, `build_sequence`, `check_and_unlock`) from `fn` to `pub(crate) fn`
- Promoted 6 constants (`MAX_ANSWERS_PER_SESSION`, `MIN_RESPONSE_MS`, `MAX_RESPONSE_MS`, `MAX_TIER`, `TRANSFER_CODE_TTL_MICROS`, `TRANSFER_CODE_CLEANUP_INTERVAL_MICROS`) from `const` to `pub(crate) const`
- Added `mod sprint; mod classroom; mod auth; mod security; mod gdpr;` declarations to lib.rs crate root
- Created five empty stub files (`sprint.rs`, `auth.rs`, `security.rs`, `classroom.rs`, `gdpr.rs`) that resolve all mod declarations
- WASM build passes with no errors: `Finished dev profile [unoptimized + debuginfo]`

## Task Commits

Each task was committed atomically:

1. **Task 1: Promote helpers/constants to pub(crate) and add mod declarations** - `a70a100` (feat)
2. **Task 2: Create empty stub files for five submodules** - `ef1d971` (feat)

## Files Created/Modified
- `server/src/lib.rs` - Added mod declarations; promoted 9 helpers and 6 constants to pub(crate)
- `server/src/sprint.rs` - Empty stub for sprint reducers (plan 07-03)
- `server/src/auth.rs` - Empty stub for auth reducers (plan 07-02)
- `server/src/security.rs` - Empty stub for security reducers (plan 07-02)
- `server/src/classroom.rs` - Empty stub for classroom reducers (plan 07-04)
- `server/src/gdpr.rs` - Empty stub for GDPR reducers (plan 07-04)

## Decisions Made
- Visibility promotion done as an isolated atomic step so the compiler can verify changes cleanly before any reducer code moves. This matches the plan intent: confirm all cross-module dependencies are visible before extraction begins.
- mod declarations placed immediately after the `use spacetimedb` line, before the CONSTANTS section — keeps imports at the top of the crate root.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- lib.rs is now the verified WASM-green foundation for plans 07-02 (auth/security), 07-03 (sprint), and 07-04 (classroom/gdpr)
- All cross-module helpers and constants are pub(crate) — submodule files can use them via `use crate::*` or direct paths
- No blockers

---
*Phase: 07-split-server-lib-rs-into-modules*
*Completed: 2026-03-15*

## Self-Check: PASSED

- server/src/lib.rs: FOUND
- server/src/sprint.rs: FOUND
- server/src/auth.rs: FOUND
- server/src/security.rs: FOUND
- server/src/classroom.rs: FOUND
- server/src/gdpr.rs: FOUND
- .planning/phases/07-split-server-lib-rs-into-modules/07-01-SUMMARY.md: FOUND
- Commit a70a100: FOUND
- Commit ef1d971: FOUND
