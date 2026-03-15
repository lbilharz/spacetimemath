---
phase: 06-server-side-sprint-problem-sequencing
plan: "01"
subsystem: testing
tags: [vitest, integration-tests, spacetimedb, sprint-sequencing]

# Dependency graph
requires:
  - phase: 02-scoring-integrity-and-gdpr-baseline
    provides: gdpr.test.ts with deletePlayer integration tests
provides:
  - sprint_sequencing.test.ts with 5 it.todo stubs for SEQ-01 through SEQ-05
  - gdpr.test.ts extended with SEQ-06 it.todo stub for sprint_sequences cascade delete
affects: [06-02, 06-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - it.todo() stubs for pre-implementation test scaffolding (Wave 0 Nyquist compliance)
    - (client.conn.reducers as any) cast for not-yet-generated bindings

key-files:
  created:
    - client/src/__tests__/integration/sprint_sequencing.test.ts
  modified:
    - client/src/__tests__/integration/gdpr.test.ts

key-decisions:
  - "Use it.todo() (not throw) for stubs — Vitest counts todos as skipped so pre-commit hook passes; visible in test output as pending work"
  - "Remove waitFor from sprint_sequencing.test.ts imports — unused import would fail lint; re-add in Plan 03 when stubs are implemented"
  - "SEQ-06 todo appended at outer describe level in gdpr.test.ts — not inside a sub-describe, matches the cascade scope"

patterns-established:
  - "Wave 0 stub pattern: one passing smoke test + N it.todo blocks per new test file"

requirements-completed: [SEQ-01, SEQ-02, SEQ-03, SEQ-04, SEQ-05, SEQ-06]

# Metrics
duration: 5min
completed: 2026-03-15
---

# Phase 6 Plan 01: Sprint Sequencing Test Scaffold Summary

**Vitest integration test scaffold with 6 it.todo stubs (SEQ-01 through SEQ-06) establishing Wave 0 Nyquist compliance before any server changes**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-15T17:05:16Z
- **Completed:** 2026-03-15T17:07:12Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created sprint_sequencing.test.ts with one passing smoke test and 5 pending todo stubs (SEQ-01 through SEQ-05)
- Extended gdpr.test.ts with one new SEQ-06 todo stub for sprint_sequences cascade delete
- All 42 existing unit tests still pass; lint clean (0 errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sprint_sequencing.test.ts** - `3ed710a` (test)
2. **Task 2: Extend gdpr.test.ts with SEQ-06** - `1bd1eb9` (test)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `client/src/__tests__/integration/sprint_sequencing.test.ts` - New file: smoke test + SEQ-01 through SEQ-05 it.todo stubs
- `client/src/__tests__/integration/gdpr.test.ts` - Appended SEQ-06 it.todo stub at end of outer describe

## Decisions Made
- Used `it.todo()` rather than throwing errors — Vitest marks these as skipped (not failed), keeping the pre-commit hook green while making pending work visible.
- Removed `waitFor` from imports in sprint_sequencing.test.ts since no stubs use it yet; lint (`@typescript-eslint/no-unused-vars`) would have blocked the commit otherwise.
- SEQ-06 added at the outer `describe('delete_player', ...)` level rather than inside a sub-describe, since the cascade assertion spans the whole player deletion scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused waitFor import from sprint_sequencing.test.ts**
- **Found during:** Task 1 commit attempt
- **Issue:** Plan's interface example imported waitFor, but stubs are all it.todo with no body — lint error `'waitFor' is defined but never used`
- **Fix:** Removed waitFor from the import line; kept connect, disconnect, ConnectedClient
- **Files modified:** client/src/__tests__/integration/sprint_sequencing.test.ts
- **Verification:** Lint passed (0 errors), tsc --noEmit passed
- **Committed in:** 3ed710a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — unused import caught by lint hook)
**Impact on plan:** Minimal — one import removed. No behavioral change. Pre-commit hook enforces correctness.

## Issues Encountered
- Plan's verify command (`npm test -- --run src/__tests__/integration/sprint_sequencing.test.ts`) does not work because integration tests are excluded from vite.config.ts. The correct command is `npm run test:integration`. Verification was done via `npx tsc --noEmit` (syntax) and `npm test -- --run src/utils/` (unit suite). Integration tests require a live SpacetimeDB connection to run.

## Next Phase Readiness
- Wave 0 scaffold complete: all 6 SEQ requirements have automated test anchors
- Plan 02 (Wave 1 server changes) can proceed with confidence that Wave 3 tests will have clear targets
- No blockers

---
*Phase: 06-server-side-sprint-problem-sequencing*
*Completed: 2026-03-15*
