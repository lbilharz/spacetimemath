---
phase: quick-260317-8vn
plan: 01
subsystem: server + client
tags: [extended-mode, progression, weighted-pool, sprint-sequencing, ux]
dependency_graph:
  requires: [Phase 10-extended-tables-opt-in (Player.extended_mode)]
  provides: [Player.extended_level, sequential x11-x20 unlock, weighted sprint pool, "+N" tier badge]
  affects: [sprint.rs build_sequence, ProgressPage tier card]
tech_stack:
  added: []
  patterns: [Fisher-Yates weighted pool with dedup, seed-idempotent extended stats, SpacetimeDB additive field migration]
key_files:
  created: [client/src/module_bindings/migrate_seed_extended_stats_reducer.ts]
  modified:
    - server/src/lib.rs
    - server/src/sprint.rs
    - server/src/auth.rs
    - server/src/classroom.rs
    - client/src/components/PageRenderer.tsx
    - client/src/pages/ProgressPage.tsx
    - client/src/module_bindings/players_table.ts
    - client/src/module_bindings/types.ts
    - client/src/module_bindings/index.ts
decisions:
  - "seed_tier1_problem_stats kept (dead code warning) for migrate_seed_extended_pairs compatibility"
  - "Dedup step uses mut rebind of pool after Fisher-Yates — compiler requires mut on shadowed binding"
  - "check_extended_level placed before credit_session_to_player would be ideal but must be after to use updated answers; called after credit for correct ordering"
  - "+N suffix only shown when extendedLevel > 0, not at level 0 (player just started extended)"
  - "Extended pills updated to full x11-x20 range (10 pills)"
metrics:
  duration: ~12 min
  completed: 2026-03-17
  tasks_completed: 4
  files_modified: 9
---

# Quick Task 260317-8vn: Extended Mode Progression (Sequential x11-x20) Summary

**One-liner:** Sequential x11-x20 extended mode unlock gated by 80% mastery per table, weighted sprint pool prioritising hard problems, and "+N" tier badge on Progress page.

## What Was Built

Full extended mode progression system:

1. **Player.extended_level field** (server/src/lib.rs): New `#[default(0)] pub extended_level: u8` field on Player struct. Auto-migrated to all existing players as 0 via SpacetimeDB additive migration.

2. **seed_extended_problem_stats** (server/src/lib.rs): Replaces `seed_tier1_problem_stats` in `init`. Seeds all 160 pairs (x11-x20) × (1-10), both orderings, at uniform weight 1.5. Idempotent via `is_none()` guard.

3. **migrate_seed_extended_stats reducer** (server/src/lib.rs): New idempotent reducer to populate extended stats on the live DB. Call via `make call REDUCER=migrate_seed_extended_stats` after deploy.

4. **build_sequence — extended_level gating** (server/src/lib.rs): Category-2 pairs now filtered to `max(a,b) <= 11 + extended_level`. Level 0 = only x11 pairs; level 9 = all x11-x20 pairs.

5. **Weighted pool in build_sequence** (server/src/lib.rs): All sprints (not just extended) now use weight-expanded pool (`copies = max(1, (weight * 3.0).round())`), Fisher-Yates shuffle, then dedup keeping first occurrence. Hard problems appear earlier in sequence.

6. **check_extended_level** (server/src/sprint.rs): Private fn called from `end_session` after `credit_session_to_player`. Checks last 10 answers for current table (11 + extended_level); if >= 5 answers and >= 80% correct, increments extended_level (max 9).

7. **SEC-06 guards updated** (server/src/sprint.rs): Both `issue_problem` and `submit_answer` guards updated from `matches!(a.max(b), 11|12|15|20|25)` to `a.max(b) >= 11 && a.max(b) <= 20`, plus per-level gate `a.max(b) > 11 + player.extended_level`.

8. **auth.rs / classroom.rs** updated: `extended_level: 0` in register struct literal; `build_sequence` calls pass `0` as extended_level in class sprint context.

9. **Client extendedLevel prop threading** (PageRenderer.tsx, ProgressPage.tsx): `extendedLevel: number` added to PageRenderer's local Player type and threaded to ProgressPage. ProgressPage Props extended with `extendedLevel?: number`.

10. **"+N" tier badge** (ProgressPage.tsx): Inline `<span>+{extendedLevel}</span>` appears after tier name when `extendedMode && extendedLevel > 0`.

11. **Extended pills** (ProgressPage.tsx): Toggle row pills updated from `[11, 12, 15, 20, 25]` to `[11, 12, 13, 14, 15, 16, 17, 18, 19, 20]` to show the full sequential range.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pool dedup binding needed `mut`**
- **Found during:** Task 1 WASM build
- **Issue:** Rust shadowing: `let pool: Vec<u16> = pool.into_iter()...collect()` creates a new immutable binding, but the adjacency-fix pass below calls `pool.swap()` which requires `&mut`.
- **Fix:** Changed to `let mut pool: Vec<u16>` on the dedup line.
- **Files modified:** server/src/lib.rs
- **Commit:** 9a9794d (included in same commit)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1: Server changes | 9a9794d | Server: extended_level field, weighted pool, check_extended_level, SEC-06 guards |
| 2: Deploy + generate | af6db26 | Deploy to maincloud, regenerate bindings with extendedLevel |
| 3: Client changes | b876fe8 | Thread extendedLevel prop, add +N tier badge, update x11-x20 pills |
| 4: Tests + lint | (via pre-commit hook on all commits) | 44 tests pass, lint warnings only |

## Self-Check: PASSED

All required files exist and all 3 task commits confirmed in git log.
