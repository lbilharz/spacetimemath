---
phase: 02-scoring-integrity-and-gdpr-baseline
plan: 02
subsystem: database
tags: [rust, spacetimedb, scoring, class-sprint, tier-unlock, integration-tests]

# Dependency graph
requires:
  - phase: 01-security-hardening
    provides: SEC-06 (tier-gated submit_answer), SEC-10 (server-issued problem tokens)
  - phase: 02-scoring-integrity-and-gdpr-baseline
    plan: 01
    provides: Failing integration test stubs for SCORE-01 and SCORE-02
provides:
  - credit_session_to_player helper in server/src/lib.rs
  - Class sprint sessions now credit BestScore and trigger tier unlock via finalize_class_sprint_sessions
  - SCORE-01 and SCORE-02 integration tests GREEN
affects: [02-03-PLAN.md, 02-04-PLAN.md]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extract-and-share pattern: post-session scoring logic extracted to credit_session_to_player, called from both end_session and finalize_class_sprint_sessions"
    - "issueAndSubmit helper in integration tests: call issueProblem, waitFor token, then submitAnswer — required for SEC-10"

key-files:
  created: []
  modified:
    - server/src/lib.rs
    - client/src/__tests__/integration/scoring.test.ts

key-decisions:
  - "credit_session_to_player placed immediately before check_and_unlock (which it calls) for locality of related functions"
  - "Integration test uses startClassSprint-created sessions (not student-initiated startSession) to exercise the finalize_class_sprint_sessions code path — the actual new code"
  - "SCORE-02 tier-unlock test submits all 16 tier-0 pairs with responseMs < 2s to trigger speed_bonus (threshold 0.5 not 0.8) — avoids needing 13 of 16 mastered, only needs 8"
  - "Test scaffold from 02-01 had wrong answer pairs (tier-1 and tier-2 pairs rejected by SEC-06) and missing SEC-10 tokens — fixed as Rule 1 bug during Task 2"

patterns-established:
  - "Class sprint session lifecycle: startClassSprint creates sessions, finalize_class_sprint_sessions closes incomplete ones on endClassSprint — students never need to call startSession or endSession for class sprints"
  - "Integration test flow for SEC-10: issueProblem → waitFor issued_problem_results row → submitAnswer with token"

requirements-completed: [SCORE-01, SCORE-02]

# Metrics
duration: 6min
completed: 2026-03-14
---

# Phase 2 Plan 02: Class Sprint Score Crediting Summary

**credit_session_to_player helper extracted from end_session and wired into finalize_class_sprint_sessions, making class sprints first-class for BestScore upsert and tier unlock**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-14T18:30:30Z
- **Completed:** 2026-03-14T18:36:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extracted post-session scoring logic (Player stats update + check_and_unlock + BestScore upsert) into `credit_session_to_player` private fn in lib.rs
- `end_session` now delegates to `credit_session_to_player` (one call replaces 40 lines)
- `finalize_class_sprint_sessions` captures session.player_identity and session.id before consuming session, then calls `credit_session_to_player` per student
- WASM build passes with zero errors after refactor
- SCORE-01 and SCORE-02 integration tests now GREEN — BestScore is created and learning_tier advances after class sprint

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract credit_session_to_player helper and wire into both paths** - `f80829c` (feat)
2. **Task 2: Deploy to test DB and verify SCORE-01 + SCORE-02 integration tests pass** - `db79209` (test)

**Plan metadata:** `[pending]` (docs: complete plan)

## Files Created/Modified
- `server/src/lib.rs` - Added credit_session_to_player fn; end_session and finalize_class_sprint_sessions both call it
- `client/src/__tests__/integration/scoring.test.ts` - Rewrote to use SEC-06-safe tier-0 pairs, SEC-10 token flow, and correct class sprint session lifecycle

## Decisions Made
- **credit_session_to_player reads session from DB** — not passed as a parameter — so it works identically whether called from end_session (session already finalized) or from finalize_class_sprint_sessions (session just finalized). Re-reads the session row to pick up scores written by finalize_session.
- **Integration test exercises finalize_class_sprint_sessions code path** — student never calls startSession or endSession; the server creates the session in startClassSprint and finalizes it in endClassSprint. This tests the actual new code, not end_session.
- **SCORE-02 uses all 16 tier-0 pairs with fast responses** — speed_bonus halves the mastery threshold from 0.8 to 0.5, making tier unlock achievable in a single sprint with 16 tier-0 pair answers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Integration test scaffold used wrong answer pairs (tier-1/tier-2) and missing SEC-10 tokens**
- **Found during:** Task 2 (Deploy to test DB and verify integration tests pass)
- **Issue:** The ANSWERS array in scoring.test.ts used pairs like {a:2, b:3} (tier 1) and {a:2, b:6} (tier 2). SEC-06 rejects these for a fresh player at tier 0. Additionally, the test called submitAnswer without a problemToken, which SEC-10 requires. The test was scaffolded in 02-01 before the full SEC-06/SEC-10 implementation was understood.
- **Fix:** Rewrote scoring.test.ts with (1) all 16 tier-0 pairs from {1,2,5,10}×{1,2,5,10}, (2) issueAndSubmit helper that calls issueProblem, waits for token in issued_problem_results, then calls submitAnswer with the token, (3) correct class sprint session lifecycle (server creates session in startClassSprint, test waits for it to appear, student never calls startSession/endSession).
- **Files modified:** `client/src/__tests__/integration/scoring.test.ts`
- **Verification:** `npm run test:integration -- -t "class sprint"` shows both tests passing (1287ms, 4480ms)
- **Committed in:** `db79209` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug, test scaffold incompatible with Phase 1 SEC-06/SEC-10)
**Impact on plan:** Auto-fix corrects the test to accurately verify the server behavior. The server-side implementation (Task 1) was correct as written; only the test needed repair.

## Issues Encountered
- Integration test scaffold from 02-01 did not account for SEC-06 (tier-gated answers) or SEC-10 (problem tokens) from Phase 1. Discovered on first test run. Resolved by rewriting the test with the correct flow.

## User Setup Required
None - no external service configuration required. `make publish-test` was run to deploy the updated server to spacetimemath-test.

## Next Phase Readiness
- SCORE-01 and SCORE-02 both GREEN — class sprints now credit scoring correctly
- Plans 02-03 (learningTier mapping update) and 02-04 (delete_player GDPR) can proceed
- solo_sprint.test.ts also has broken submitAnswer calls (missing problemToken) — pre-existing regression to note but out of scope for this plan

---
*Phase: 02-scoring-integrity-and-gdpr-baseline*
*Completed: 2026-03-14*

## Self-Check: PASSED

- FOUND: server/src/lib.rs
- FOUND: client/src/__tests__/integration/scoring.test.ts
- FOUND: .planning/phases/02-scoring-integrity-and-gdpr-baseline/02-02-SUMMARY.md
- FOUND: commit f80829c (Task 1)
- FOUND: commit db79209 (Task 2)
- FOUND: fn credit_session_to_player at server/src/lib.rs:716
