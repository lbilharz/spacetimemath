---
phase: 02-scoring-integrity-and-gdpr-baseline
plan: 03
subsystem: database
tags: [rust, spacetimedb, typescript, vitest, tier-system, migration]

# Dependency graph
requires:
  - phase: 02-scoring-integrity-and-gdpr-baseline
    provides: Plan 02-01 scaffolded learningTier.test.ts with todo tests for new tier model
provides:
  - 8-tier multiplier-column factor_tier in server (MAX_TIER=7, ×1/×2/×10→×3→×5→×4→×6→×7→×8→×9)
  - migrate_recompute_tiers_v2 reducer for re-tiering existing players with BestScore sync
  - Matching factorTier function in client learningTier.ts
  - All 12 learningTier.test.ts unit tests passing (converted from todo)
affects: [issue_problem tier gating, unlock progression, leaderboard learning_tier display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MAX_TIER constant for tier loop bounds — single source of truth for tier ceiling"
    - "Extended factors (×11–×25) return None/99 — excluded from pool in both server and client"

key-files:
  created: []
  modified:
    - server/src/lib.rs
    - client/src/utils/learningTier.ts
    - client/src/utils/learningTier.test.ts

key-decisions:
  - "×5 moved from tier 0 to tier 2 — issue_problem rejects ×5 pairs for tier-0 players post-deploy"
  - "×4 moved from tier 1 to tier 3 — unlocked later than ×5 per pedagogical sequence"
  - "Extended factors (×11, ×12, ×15, ×20, ×25) now return None (excluded) — previously returned Some(3)"
  - "migrate_recompute_tiers_v2 resets player to tier 0 and re-runs check_and_unlock rather than recomputing tier from scratch — simpler and consistent with normal unlock logic"
  - "todo tests in learningTier.test.ts activated as real assertions in this plan (they were scaffolded pending in 02-01)"

patterns-established:
  - "Server MAX_TIER constant drives both check_and_unlock loop and migration reducer — change one constant to add tiers"
  - "Client factorTier mirrors server factor_tier exactly — same factor→tier mapping"

requirements-completed: [SCORE-03]

# Metrics
duration: 2min
completed: 2026-03-14
---

# Phase 02 Plan 03: Tier Structure Redesign Summary

**8-tier multiplier-column model (SCORE-03): ×1/×2/×10→×3→×5→×4→×6→×7→×8→×9 with extended factors excluded, server and client in sync, migration reducer ready**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-14T17:39:34Z
- **Completed:** 2026-03-14T17:41:23Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Replaced old 4-bucket factorTier (×5 with tier 0, ×4 with tier 1) with pedagogically correct 8-tier ladder
- Added MAX_TIER = 7 constant and updated check_and_unlock loop bound from hardcoded `3u8`
- Added migrate_recompute_tiers_v2 that resets and re-advances each player's tier, syncing BestScore
- Activated 8 pending learningTier.test.ts assertions — all 12 tests now pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Update learningTier.ts (RED → GREEN for unit tests)** - `a18ceed` (feat)
2. **Task 2: Update server factor_tier, check_and_unlock, add migrate_recompute_tiers_v2** - `2948dd0` (feat)

## Files Created/Modified

- `client/src/utils/learningTier.ts` - New 8-tier factorTier implementation (×1/×2/×10=0, ×3=1, ×5=2, ×4=3, ×6=4, ×7=5, ×8=6, ×9=7, extended=99)
- `client/src/utils/learningTier.test.ts` - Activated 8 todo tests as real assertions + ×11 exclusion test
- `server/src/lib.rs` - MAX_TIER constant, new factor_tier, updated check_and_unlock loop, migrate_recompute_tiers_v2 reducer

## Decisions Made

- Activated the `.todo` test assertions from Plan 02-01 scaffolding in this plan rather than in a separate step — the tests were designed as pending, not pre-failing, so the plan's "RED" phase was confirming they were in todo state, then GREEN implemented and activated them simultaneously.
- `migrate_recompute_tiers_v2` uses reset-then-check_and_unlock approach (rather than directly recomputing tier from answer history like v1 does) — this ensures the migration uses exactly the same unlock logic as the live game, avoiding divergence.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

After deploying the server update, the migration must be run manually:

```
make call REDUCER=migrate_recompute_tiers_v2
```

This re-tiers all existing players under the new 8-tier model and syncs BestScore.learning_tier.

## Next Phase Readiness

- SCORE-03 complete: tier structure is correct server-side and client-side
- issue_problem tier gating will now correctly require tier 2 for ×5 problems (was tier 0)
- Ready for Phase 2 remaining plans (GDPR baseline)
- Post-deploy: run migrate_recompute_tiers_v2 to correct existing player tiers

---
*Phase: 02-scoring-integrity-and-gdpr-baseline*
*Completed: 2026-03-14*
