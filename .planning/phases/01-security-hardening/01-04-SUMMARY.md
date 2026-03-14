---
phase: 01-security-hardening
plan: "04"
subsystem: api
tags: [rust, spacetimedb, wasm, security, rate-limiting, input-validation]

# Dependency graph
requires:
  - phase: 01-security-hardening
    provides: Security test scaffold (SEC-01 through SEC-10) from Plan 01-01
provides:
  - submit_answer hardened with response_ms bounds (SEC-05), session answer cap (SEC-04), and tier validation (SEC-06)
  - MAX_ANSWERS_PER_SESSION, MIN_RESPONSE_MS, MAX_RESPONSE_MS constants in server
affects: [01-security-hardening, 02-gdpr-compliance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guards-before-insert: all validation checks in submit_answer appear before ctx.db.answers().insert() to prevent partial state on rejection"
    - "Named constants over magic numbers: SEC thresholds defined as named Rust constants"

key-files:
  created: []
  modified:
    - server/src/lib.rs

key-decisions:
  - "All three guards (SEC-04, SEC-05, SEC-06) are placed before the Answer insert, not after — no partial state if any guard fires"
  - "SEC-06 tier check reuses the existing pair_learning_tier() helper; _player renamed to player to enable reuse"
  - "Integration tests target spacetimemath-test on maincloud, not spacetimemath — publish-test is required after any server change"

patterns-established:
  - "Security guards order: response_ms bounds first (cheapest), then session cap (one DB scan), then tier check (two fn calls)"

requirements-completed: [SEC-04, SEC-05, SEC-06]

# Metrics
duration: 18min
completed: 2026-03-14
---

# Phase 1 Plan 4: submit_answer Hardening Summary

**Three independent security guards added to submit_answer: response_ms floor/ceiling (SEC-05), per-session answer cap of 80 (SEC-04), and problem pair tier validation against player's learning tier (SEC-06)**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-14T12:10:09Z
- **Completed:** 2026-03-14T12:16:11Z
- **Tasks:** 2
- **Files modified:** 1 (server/src/lib.rs)

## Accomplishments

- Added `MAX_ANSWERS_PER_SESSION = 80`, `MIN_RESPONSE_MS = 200`, `MAX_RESPONSE_MS = 120_000` as named constants
- SEC-05: submit_answer rejects response_ms < 200 with "Response time below minimum threshold"
- SEC-05: submit_answer rejects response_ms > 120_000 with "Response time above maximum threshold"
- SEC-04: submit_answer rejects the 81st answer in a session with "Session answer limit reached"
- SEC-06: submit_answer rejects a pair above the player's learning_tier with "Problem pair above player's current tier"
- SEC-06: submit_answer rejects a=0 (excluded factor) with "Invalid problem pair"
- Deployed to both spacetimemath and spacetimemath-test on maincloud
- SEC-04, SEC-05, SEC-06 integration tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add per-session answer cap, response_ms bounds, and tier validation** - `3fec04c` (feat)
2. **Task 2: Deploy and run integration tests** - no new files (deploy-only task; leftover Plan 03 changes committed as `d067b71`)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `/Users/lbi/Projects/spacetimemath/server/src/lib.rs` - Added three guard blocks before Answer insert in submit_answer, added named constants near top of file

## Decisions Made

- All guards placed before `ctx.db.answers().insert()` — plan specifies this explicitly (PITFALLS reference) to prevent partial state
- `_player` renamed to `player` so the variable can be reused for the SEC-06 tier check without needing a second DB lookup
- Security guard ordering: response_ms bounds (no DB cost) → session count (one iter scan) → tier check (pure function calls) — cheapest first

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deployed to spacetimemath-test, not just spacetimemath**
- **Found during:** Task 2 (Deploy and run integration tests)
- **Issue:** Integration tests connect to `spacetimemath-test` database (per global-setup.ts), not `spacetimemath`. The initial `make publish` only updated production. Tests ran against old code and all failed with "promise resolved instead of rejecting".
- **Fix:** Ran `make publish-test` to deploy the updated WASM to `spacetimemath-test`. All three SEC-04/05/06 tests then passed.
- **Files modified:** None (deploy operation)
- **Verification:** SEC-04, SEC-05, SEC-06 all pass after deploy-test
- **Committed in:** N/A (deploy, not a code change)

**2. [Rule 3 - Blocking] Committed leftover Plan 03 module_bindings changes**
- **Found during:** Task 2 (post-deploy test run)
- **Issue:** SEC-01/SEC-02 tests were failing with TypeError because the test file accessed `.iter()` directly on private table accessors which return undefined. The fix was already written in the working tree but not committed (from Plan 03).
- **Fix:** Committed the leftover Plan 03 changes: SEC-01/02 test guard fix, removal of recovery_keys_table.ts and transfer_codes_table.ts, updated index.ts.
- **Files modified:** client/src/__tests__/integration/security.test.ts, client/src/module_bindings/index.ts, client/src/module_bindings/types.ts, deleted recovery_keys_table.ts, deleted transfer_codes_table.ts
- **Verification:** SEC-01 and SEC-02 now pass; unit tests still green
- **Committed in:** d067b71

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both fixes necessary to complete Task 2 verification. No scope creep.

## Issues Encountered

- The `spacetimemath-test` database had not been updated since before Plan 02/03. Publishing to it for the first time brought it fully up to date (private tables, new reducers, and Plan 04 guards all in one publish).
- SEC-03 test still fails with "Cannot read properties of undefined (reading 'iter')" — the `recoveryCodeResults` table accessor is not registered in the current client bindings for `spacetimemath-test`. This is a Plan 02 issue that requires `get_my_recovery_code` reducer + result table subscription to be fully wired up. Deferred.

## User Setup Required

None - no external service configuration required. Server deployed to maincloud.

## Next Phase Readiness

- SEC-04, SEC-05, SEC-06 closed: bot/replay submissions, session flooding, and out-of-tier cherry-picking are all server-rejected
- Phase 1 Plan 5 (problem token validation — SEC-10) is the final security plan
- SEC-03 (recoveryCodeResults table accessor) needs to be addressed in a follow-up to Plan 02

---
*Phase: 01-security-hardening*
*Completed: 2026-03-14*
