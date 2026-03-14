---
phase: 01-security-hardening
plan: "05"
subsystem: api
tags: [rust, spacetimedb, wasm, security, tokens, react, typescript]

# Dependency graph
requires:
  - phase: 01-security-hardening
    provides: submit_answer guards (SEC-04, SEC-05, SEC-06) from Plan 01-04
  - phase: 01-security-hardening
    provides: Private table pattern (write-to-table pattern) from Plan 01-02
provides:
  - IssuedProblem private table and IssuedProblemResult public table on server (SEC-10)
  - issue_problem reducer: validates session ownership, tier, inserts token
  - submit_answer updated with problem_token parameter and token verification (one-time use)
  - SprintPage calls issueProblem before each problem, passes token to submitAnswer
affects: [01-security-hardening, integration-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-issued token pattern: issue_problem writes token to result table; client reads it back; submit_answer verifies and deletes"
    - "One-time token consumption: IssuedProblem row deleted on use; IssuedProblemResult row cleaned up simultaneously"
    - "Public result table for client-readable tokens: IssuedProblemResult is public (not private) because SpacetimeDB 2.0.3 cannot push private table rows to clients via subscription"

key-files:
  created:
    - client/src/module_bindings/issue_problem_reducer.ts
    - client/src/module_bindings/issued_problem_results_table.ts
  modified:
    - server/src/lib.rs
    - client/src/module_bindings/index.ts
    - client/src/module_bindings/submit_answer_reducer.ts
    - client/src/module_bindings/types.ts
    - client/src/module_bindings/types/reducers.ts
    - client/src/pages/SprintPage.tsx
    - client/src/__tests__/helpers.ts

key-decisions:
  - "IssuedProblemResult is public (not private) — SpacetimeDB 2.0.3 private tables cannot receive row pushes; confirmed by prior Plan 03 research. Token is short-lived (consumed on submit) so public exposure is acceptable"
  - "make_code() reused for token generation — same 6-char FNV-1a hash, adequate entropy for a short-lived session token"
  - "submitted token must match session_id + a + b + token — all four fields required to prevent token reuse across different problem pairs"
  - "IssuedProblemResult row upserted (update if exists, insert if not) — player may reload before submitting, leaving stale row"
  - "SprintPage reads token from issuedProblemResults before submit; if token not yet arrived (race condition), submission is silently skipped"

patterns-established:
  - "Server-deals-problems pattern: issue_problem reducer acts as server-side 'deal', enforcing that only problems the server explicitly dealt can be answered"

requirements-completed: [SEC-10]

# Metrics
duration: ~25min
completed: 2026-03-14
---

# Phase 1 Plan 5: Problem Token Flow (SEC-10) Summary

**Server-issued problem token (SEC-10): issue_problem reducer deals tokens, submit_answer verifies one-time use, SprintPage updated to call issueProblem before each answer submission**

## Performance

- **Duration:** ~25 min (Tasks 1-2 automated, Task 3 human verified)
- **Started:** 2026-03-14T12:33:10Z
- **Completed:** 2026-03-14
- **Tasks:** 3 of 3 completed
- **Files modified:** 7 files

## Accomplishments

- Added `IssuedProblem` private table (server-side token store: id auto_inc, session_id, a, b, token)
- Added `IssuedProblemResult` public table (client-readable result: owner, token)
- Added `issue_problem` reducer: validates session ownership, learning tier, inserts token row, upserts result row
- Updated `submit_answer` with `problem_token: String` parameter; verifies token against issued row and deletes after use
- Regenerated TypeScript bindings: `issue_problem_reducer.ts`, `issued_problem_results_table.ts`, updated `submit_answer_reducer.ts`
- Restored hand-written private table entries in `index.ts` (codegen overwrites these)
- SprintPage: `issueProblem` called when first problem selected and after each answer cycle
- SprintPage: token read from `issuedProblemResults` subscription and passed as `problemToken` to `submitAnswer`
- TypeScript compiles with no errors; 25 unit tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add IssuedProblem tables, issue_problem reducer, update submit_answer** - `86403bc` (feat)
2. **Task 2: Regenerate bindings and update SprintPage.tsx to use issue_problem flow** - `b5634eb` (feat)
3. **Task 3: Human end-to-end verification** — APPROVED (5/5 correct answers, 100% accuracy, score 6.4; issueProblem → submitAnswer token flow confirmed end-to-end)

## Files Created/Modified

- `/Users/lbi/Projects/spacetimemath/server/src/lib.rs` - Added IssuedProblem private table, IssuedProblemResult public table, issue_problem reducer, submit_answer gains problem_token parameter with token verification and cleanup
- `/Users/lbi/Projects/spacetimemath/client/src/module_bindings/issue_problem_reducer.ts` - Generated reducer arg schema (sessionId, a, b)
- `/Users/lbi/Projects/spacetimemath/client/src/module_bindings/issued_problem_results_table.ts` - Generated table row schema (owner, token)
- `/Users/lbi/Projects/spacetimemath/client/src/module_bindings/submit_answer_reducer.ts` - Regenerated with problemToken field
- `/Users/lbi/Projects/spacetimemath/client/src/module_bindings/index.ts` - Updated with issueProblem reducer + issued_problem_results table; hand-written private table entries restored
- `/Users/lbi/Projects/spacetimemath/client/src/module_bindings/types.ts` - Regenerated types
- `/Users/lbi/Projects/spacetimemath/client/src/module_bindings/types/reducers.ts` - Regenerated reducer types
- `/Users/lbi/Projects/spacetimemath/client/src/pages/SprintPage.tsx` - issueProblem hook, issuedProblemResults table, token read + pass to submitAnswer, issueProblem called on each new problem
- `/Users/lbi/Projects/spacetimemath/client/src/__tests__/helpers.ts` - Added issued_problem_results to ALL_TABLES

## Decisions Made

- **IssuedProblemResult is public**: SpacetimeDB 2.0.3 cannot push private table rows to client subscriptions (confirmed in Plan 03 research and State blockers). The token is a short-lived gameplay token (not a secret credential), so public exposure is acceptable. The token is deleted on submit.
- **make_code() reused**: The existing 6-char FNV-1a token generator is adequate for a short-lived session token — hard to guess within the seconds between issueProblem and submitAnswer.
- **Silent skip on missing token**: If the token hasn't arrived when the user submits (rare race condition on slow connections), the submission is silently skipped rather than showing an error — better UX for an edge case.
- **Upsert pattern for IssuedProblemResult**: Same as transfer_code_results/recovery_code_results. One row per player, overwritten when a new problem is dealt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored hand-written private table entries in index.ts after make generate**
- **Found during:** Task 2 (regenerate bindings)
- **Issue:** `make generate` overwrites `index.ts` completely, removing the hand-written `recovery_code_results` and `transfer_code_results` table entries added in Plan 02.
- **Fix:** Re-added the import statements and table schema entries for `RecoveryCodeResultRow` and `TransferCodeResultRow` with the expected comments.
- **Files modified:** `client/src/module_bindings/index.ts`
- **Verification:** TypeScript compiles; recovery/transfer code table types still accessible
- **Committed in:** b5634eb (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Required to preserve AccountPage functionality from Plan 02. No scope creep.

## Issues Encountered

- SpacetimeDB 2.0.3 private table limitation confirmed again: `issued_problem_results` must be public. This was anticipated in the plan's open question — the answer is consistent with Plan 03 research findings already in STATE.md.

## User Setup Required

**Deploy required before human verification can proceed:**
1. Deploy server: `cd /Users/lbi/Projects/spacetimemath && make publish` (schema-breaking change — submit_answer parameter added, use `--break-clients` if needed)
2. Deploy to test DB: `make publish-test` (for integration tests)
3. Run `make generate` (already done in this plan)
4. Rebuild client: `cd client && npm run build`

## Known Regression: AccountPage Recovery Code Display

The `recovery_code_results` and `transfer_code_results` tables on the server are private (not `public`). This means the AccountPage's recovery code display is currently broken — the subscription cannot receive rows from private tables. This is a known regression deferred to Phase 3 (UX and Client Bug Fixes). Not introduced in this plan; inherited from Plan 02/03 private table decisions.

## Next Phase Readiness

- Phase 1 (Security Hardening) is COMPLETE — all SEC-01 through SEC-10 requirements closed and verified
- Phase 2 (Scoring Integrity and GDPR Baseline) can begin

---
*Phase: 01-security-hardening*
*Completed: 2026-03-14*
