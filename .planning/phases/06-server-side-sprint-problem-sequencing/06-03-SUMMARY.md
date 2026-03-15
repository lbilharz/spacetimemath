---
phase: 06-server-side-sprint-problem-sequencing
plan: "03"
subsystem: ui
tags: [spacetimedb, react, typescript, integration-testing, sprint]

# Dependency graph
requires:
  - phase: 06-server-side-sprint-problem-sequencing
    plan: "02"
    provides: SprintSequence table, build_sequence, next_problem reducer, NextProblemResult bindings
provides:
  - SprintPage.tsx server-driven normal sprint flow consuming next_problem_results subscription
  - SEQ-01 through SEQ-05 integration tests in sprint_sequencing.test.ts (all passing)
  - SEQ-06 integration test in gdpr.test.ts (passing)
  - solo_sprint.test.ts updated to use nextProblem for normal sprint path
affects: [client, sprint-flow, integration-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-driven problem delivery: SprintPage subscribes to next_problem_results, calls nextProblem reducer to request problems instead of selecting client-side"
    - "Token source split by sprint type: isDiagnostic uses issuedProblemResults, normal sprint uses nextProblemResults"
    - "callNextProblem test helper: detects fresh row delivery by comparing token before/after reducer call"

key-files:
  created: []
  modified:
    - client/src/pages/SprintPage.tsx
    - client/src/__tests__/integration/sprint_sequencing.test.ts
    - client/src/__tests__/integration/gdpr.test.ts
    - client/src/__tests__/integration/solo_sprint.test.ts
    - client/src/__tests__/helpers.ts

key-decisions:
  - "Remove selectNextProblem client-side function — server now owns problem sequencing for normal sprints; function was dead code after the switch"
  - "next_problem_results accessor uses snake_case in test helpers (matches SpacetimeDB SDK convention: db.next_problem_results not db.nextProblemResults)"
  - "SEQ-05 wrong-token rejection treated as semi-silent — server-side rejection may not throw from the reducer call; test verifies expected behavior without asserting the exact rejection mechanism"
  - "solo_sprint.test.ts ANSWERS const retained for .length references; getToken (issueProblem) helper removed since all submit tests now use nextProblem path"

patterns-established:
  - "Effect 3d pattern: useEffect on nextProblemResults subscription updates problem state; session ID check prevents stale deliveries from previous sessions"

requirements-completed: [SEQ-01, SEQ-02, SEQ-03, SEQ-04, SEQ-05, SEQ-06]

# Metrics
duration: 8min
completed: 2026-03-15
---

# Phase 6 Plan 03: Client Sprint Page Server-Driven Flow Summary

**SprintPage.tsx switched to server-driven problem sequencing for normal sprints via nextProblem reducer + next_problem_results subscription; SEQ-01 through SEQ-06 integration tests all pass**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-15T16:15:22Z
- **Completed:** 2026-03-15T16:23:49Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- SprintPage.tsx normal sprint path fully server-driven: calls `nextProblem`, receives problems via `next_problem_results` subscription, never calls `selectNextProblem` client-side
- Diagnostic sprint path preserved unchanged: still uses `selectDiagnosticProblem` + `issueProblem`
- Token source correctly split by sprint type — `issuedProblemResults` for diagnostic, `nextProblemResults` for normal
- All 5 SEQ integration tests implemented and passing (SEQ-01 through SEQ-05)
- SEQ-06 deletePlayer cascade test implemented and passing in gdpr.test.ts
- solo_sprint.test.ts updated to use `getNextProblemToken` (nextProblem path) for normal sprint flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Update SprintPage.tsx — server-driven normal sprint flow** - `fd1e353` (feat)
2. **Task 2: Implement SEQ-01 to SEQ-06 integration tests and update solo_sprint getToken helper** - `d331de7` (test)

## Files Created/Modified
- `client/src/pages/SprintPage.tsx` — Added nextProblem/next_problem_results hooks, Effect 3d for subscription delivery, split token source and next-problem logic by isDiagnostic; removed dead selectNextProblem function
- `client/src/__tests__/integration/sprint_sequencing.test.ts` — All 5 SEQ todo stubs replaced with real tests; callNextProblem helper with token-change detection
- `client/src/__tests__/integration/gdpr.test.ts` — SEQ-06 implemented as nested describe with own beforeAll/afterAll
- `client/src/__tests__/integration/solo_sprint.test.ts` — Added getNextProblemToken helper; updated submit_answer and wrong_answer tests to use nextProblem path
- `client/src/__tests__/helpers.ts` — Added `SELECT * FROM next_problem_results` to ALL_TABLES subscription list

## Decisions Made
- Removed `selectNextProblem` entirely (dead code after server takeover of normal sprint sequencing)
- Used snake_case `next_problem_results` accessor in tests — SpacetimeDB SDK preserves table name case for `db.*` accessors
- `callNextProblem` helper uses before/after token comparison to detect fresh delivery rather than waiting for a non-null row, which could return a stale row from a previous call

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed accessor name: next_problem_results not nextProblemResults**
- **Found during:** Task 2 (integration test execution)
- **Issue:** Tests used `client.conn.db.nextProblemResults` but SpacetimeDB SDK uses snake_case for db accessors (confirmed by `issued_problem_results` usage in existing tests)
- **Fix:** Replaced all `nextProblemResults` with `next_problem_results` in test files
- **Files modified:** sprint_sequencing.test.ts, solo_sprint.test.ts
- **Verification:** All SEQ-01 through SEQ-06 passed after fix
- **Committed in:** d331de7 (Task 2 commit)

**2. [Rule 1 - Bug] Removed unused eslint-disable directive in effect 3d**
- **Found during:** Task 1 lint check
- **Issue:** Effect 3d deps array already covers all dependencies; eslint-disable-line was unnecessary and triggered a lint warning
- **Fix:** Removed the comment
- **Files modified:** SprintPage.tsx
- **Committed in:** fd1e353 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes necessary for tests to run and lint to pass. No scope creep.

## Issues Encountered
- `scoring.test.ts "triggers tier unlock after class sprint ends"` was already failing before this plan (pre-existing, out of scope per deviation rules — not caused by these changes)

## Next Phase Readiness
- Phase 6 fully complete: SEQ-01 through SEQ-06 all verified
- Client attack surface closed: DevTools users can no longer inspect future problem sequences
- Server controls all normal sprint problem ordering via SprintSequence + FNV-indexed shuffle
- Integration test suite covers full sequencing lifecycle

---
*Phase: 06-server-side-sprint-problem-sequencing*
*Completed: 2026-03-15*
