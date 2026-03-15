---
phase: 07-split-server-lib-rs-into-modules
plan: 03
subsystem: server
tags: [rust, spacetimedb, refactor, modules]

# Dependency graph
requires:
  - phase: 07-02
    provides: auth.rs and security.rs populated with their reducers
provides:
  - sprint.rs with 5 reducers and 2 pub(crate) helpers ready for classroom.rs use
  - lib.rs stripped of all sprint reducer code (~365 lines removed)
affects:
  - 07-04 (classroom.rs extraction — calls sprint::finalize_session and sprint::credit_session_to_player)

# Tech tracking
tech-stack:
  added: []
  patterns: [table accessor traits imported per-module via use crate::{accessor_name}; — required for ctx.db.table() calls in child modules]

key-files:
  created: []
  modified:
    - server/src/sprint.rs
    - server/src/lib.rs

key-decisions:
  - "fnv_index not imported in sprint.rs — only build_sequence (which lives in lib.rs) uses it; sprint.rs functions don't call fnv_index directly"
  - "finalize_class_sprint_sessions in lib.rs updated to call sprint::finalize_session and sprint::credit_session_to_player using module path syntax"

patterns-established:
  - "Table accessor traits must be imported explicitly in each child module: use crate::{sessions, players, ...}"

requirements-completed: [MOD-01, MOD-03]

# Metrics
duration: 3min
completed: 2026-03-15
---

# Phase 7 Plan 03: Sprint Extraction Summary

**5 sprint reducers and 2 pub(crate) helpers moved from lib.rs into sprint.rs; WASM build green after adding table accessor trait imports**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-15T20:00:32Z
- **Completed:** 2026-03-15T20:03:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extracted start_session, issue_problem, next_problem, submit_answer, end_session into sprint.rs with all bodies verbatim
- finalize_session and credit_session_to_player declared pub(crate) in sprint.rs so classroom.rs can call them in plan 07-04
- Removed ~365 lines of sprint code from lib.rs
- WASM build passes; client test suite stays green (42/42)

## Task Commits

1. **Task 1: Populate sprint.rs and remove sprint code from lib.rs** - `d540621` (feat)
2. **Task 2: Verify client tests still pass** - included in Task 1 commit (verification only, no code changes)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `server/src/sprint.rs` - Fully populated with 5 reducers + 2 pub(crate) helpers (~370 lines)
- `server/src/lib.rs` - Sprint code removed; finalize_class_sprint_sessions updated to call sprint:: paths

## Decisions Made
- `fnv_index` not imported in sprint.rs — it is used only inside `build_sequence` which stays in lib.rs; removing it from sprint.rs imports eliminates the unused import warning
- `finalize_class_sprint_sessions` in lib.rs calls the helpers via `sprint::finalize_session` and `sprint::credit_session_to_player` module paths rather than importing them into lib.rs scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added table accessor trait imports to sprint.rs**
- **Found during:** Task 1 (WASM build attempt)
- **Issue:** SpacetimeDB table accessor traits are not inherited from lib.rs — each child module must import them explicitly or `ctx.db.sessions()` etc. would not compile
- **Fix:** Added `use crate::{players, sessions, answers, issued_problems, issued_problem_results, sprint_sequences, next_problem_results, problem_stats, best_scores};` to sprint.rs
- **Files modified:** server/src/sprint.rs
- **Verification:** WASM build passes after fix
- **Committed in:** d540621 (Task 1 commit)

**2. [Rule 3 - Blocking] Updated lib.rs to call sprint:: paths for finalize_session and credit_session_to_player**
- **Found during:** Task 1 (WASM build attempt)
- **Issue:** `finalize_class_sprint_sessions` in lib.rs called the two helpers directly — they were no longer in scope after the move
- **Fix:** Changed calls to `sprint::finalize_session` and `sprint::credit_session_to_player`
- **Files modified:** server/src/lib.rs
- **Verification:** WASM build passes after fix
- **Committed in:** d540621 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both fixes are a standard consequence of Rust module extraction — table trait imports and cross-module function references. No scope creep.

## Issues Encountered
None beyond the expected module-boundary fixes described above.

## Next Phase Readiness
- sprint.rs complete; pub(crate) helpers exposed for classroom.rs
- plan 07-04 can now extract classroom reducers and call sprint::finalize_session / sprint::credit_session_to_player

---
*Phase: 07-split-server-lib-rs-into-modules*
*Completed: 2026-03-15*
