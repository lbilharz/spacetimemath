---
phase: 02-scoring-integrity-and-gdpr-baseline
plan: 01
subsystem: testing
tags: [vitest, tdd, integration-tests, unit-tests]

# Dependency graph
requires:
  - phase: 01-security-hardening
    provides: Integration test helpers (connect/waitFor/disconnect), class sprint reducers in module bindings
provides:
  - Failing/pending integration test stubs for SCORE-01, SCORE-02 (class sprint scoring)
  - Failing integration test stubs for GDPR-01 (delete_player)
  - Pending unit test stubs for SCORE-03 (learningTier factor-tier ladder)
affects: [02-03-PLAN.md, 02-04-PLAN.md]

# Tech tracking
tech-stack:
  added: []
  patterns: [TDD RED stubs with it.todo for unit tests that block pre-commit hook, integration stubs using (as any) cast for future reducers]

key-files:
  created:
    - client/src/__tests__/integration/scoring.test.ts
    - client/src/__tests__/integration/gdpr.test.ts
    - client/src/utils/learningTier.test.ts
  modified: []

key-decisions:
  - "learningTier tier progression tests use it.todo (pending) not failing assertions — satisfies must_haves 'skipped or pending' criterion and avoids blocking pre-commit hook"
  - "gdpr.test.ts uses (as any) cast for deletePlayer — reducer does not exist yet in bindings, same pattern used in security.test.ts"

patterns-established:
  - "TDD stubs for future reducers: use (client.conn.reducers as any).futureReducer({}) pattern"
  - "TDD stubs for future unit implementations: use it.todo('test name') with expected assertion in comment"

requirements-completed: [SCORE-01, SCORE-02, SCORE-03, GDPR-01]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 2 Plan 01: Wave 0 Test Scaffolds Summary

**Three TDD stub files (2 integration, 1 unit) establishing Nyquist feedback loop for all Phase 2 requirements before any implementation begins**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T17:25:52Z
- **Completed:** 2026-03-14T17:28:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `scoring.test.ts` with two class sprint integration stubs (SCORE-01: BestScore after sprint, SCORE-02: tier unlock after sprint) — RED until server end_class_sprint credits scores
- Created `gdpr.test.ts` with two delete_player integration stubs (GDPR-01) — RED until Plan 02-04 deploys the reducer
- Created `learningTier.test.ts` with 12 unit stubs defining the new 8-tier factor ladder (SCORE-03) — pending (it.todo) until Plan 02-03 updates the mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scoring integration test stubs (SCORE-01, SCORE-02)** - `37187a6` (test)
2. **Task 2: Create gdpr integration test stub (GDPR-01) and learningTier unit test (SCORE-03)** - `3eb373a` (test)

**Plan metadata:** `[pending]` (docs: complete plan)

## Files Created/Modified
- `client/src/__tests__/integration/scoring.test.ts` - Class sprint scoring integration stubs for SCORE-01/SCORE-02
- `client/src/__tests__/integration/gdpr.test.ts` - delete_player integration stubs for GDPR-01
- `client/src/utils/learningTier.test.ts` - Factor-tier mapping unit stubs for SCORE-03

## Decisions Made
- **learningTier tests use `it.todo` not failing assertions:** The pre-commit hook runs `npm test` (unit tests), so actively-failing unit tests block commits. Using `it.todo` shows them as pending/todo, satisfying the must_haves criterion ("skipped or pending, not erroring") while still scaffolding the test names and expected values in comments.
- **gdpr.test.ts uses `(as any)` cast for deletePlayer:** The reducer doesn't exist in generated bindings yet. Pattern matches security.test.ts which does the same for future SEC reducers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used it.todo instead of failing assertions for learningTier unit tests**
- **Found during:** Task 2 verification
- **Issue:** Pre-commit hook runs `npm test` (unit tests). Actively failing unit tests caused exit code 1, blocking the commit. The plan's `<behavior>` said "FAIL" but the must_haves truth said "skipped or pending (not erroring)."
- **Fix:** Changed tier progression and ×11 tests to `it.todo('test name')` with expected assertion in comment. Satisfied must_haves criterion while preserving scaffolding intent.
- **Files modified:** `client/src/utils/learningTier.test.ts`
- **Verification:** `npm test -- -t factorTier` exits with all tests todo/pending. Pre-commit hook passes.
- **Committed in:** `3eb373a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug, test hook vs plan behavior conflict)
**Impact on plan:** Deviation resolves conflict between plan `<behavior>` wording and explicit must_haves truth. No scope creep. All three test files scaffold the correct test names and assertions for Plans 02-03 and 02-04 to turn GREEN.

## Issues Encountered
- Pre-commit hook conflict: unit test stubs that intentionally fail (RED) block commits. Resolved by using `it.todo` per the must_haves specification.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three stub files exist and TypeScript-compile cleanly
- Plans 02-03 (learningTier update) and 02-04 (delete_player reducer) have runnable verify targets
- Integration stubs use correct reducer names and table iterators consistent with current module bindings

---
*Phase: 02-scoring-integrity-and-gdpr-baseline*
*Completed: 2026-03-14*
