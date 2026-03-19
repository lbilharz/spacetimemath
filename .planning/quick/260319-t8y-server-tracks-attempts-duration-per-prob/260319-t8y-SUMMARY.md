---
phase: quick
plan: 260319-t8y
subsystem: learner-model
tags: [attempts, mastery, sprint, server, client, spacetimedb]
dependency_graph:
  requires: []
  provides: [attempt-count-tracking, weighted-mastery-formula]
  affects: [Answer table, submit_answer reducer, check_and_unlock, migrate_recompute_tiers, SprintPage]
tech_stack:
  added: []
  patterns: [attempts-weighted accuracy (1.0/0.6/0.3), pendingAnswerRef with attempts]
key_files:
  modified:
    - server/src/lib.rs
    - server/src/sprint.rs
    - client/src/pages/SprintPage.tsx
    - client/src/module_bindings/submit_answer_reducer.ts
    - client/src/module_bindings/answers_table.ts
    - client/src/module_bindings/index.ts
    - client/src/module_bindings/types.ts
    - client/src/module_bindings/types/reducers.ts
  created:
    - client/src/module_bindings/migrate_close_orphan_sessions_reducer.ts
    - client/src/module_bindings/restore_answer_reducer.ts
    - client/src/module_bindings/restore_best_score_reducer.ts
    - client/src/module_bindings/restore_classroom_member_reducer.ts
    - client/src/module_bindings/restore_classroom_reducer.ts
    - client/src/module_bindings/restore_player_full_reducer.ts
    - client/src/module_bindings/restore_recovery_key_reducer.ts
    - client/src/module_bindings/restore_session_reducer.ts
decisions:
  - "attempt weight: 1st=1.0, 2nd=0.6, 3+=0.3 (plan-specified, no alternatives evaluated)"
  - "legacy data (attempts=0) treated as first-attempt correct for backward compat"
  - "migrate_recompute_tiers uses same weighted formula as check_and_unlock for consistency"
metrics:
  duration_minutes: 7
  tasks_completed: 3
  tasks_total: 3
  files_modified: 8
  files_created: 8
  completed_date: "2026-03-19"
---

# Phase quick Plan 260319-t8y: Server Tracks Attempts Per Problem Summary

Per-problem attempt count tracked end-to-end: Answer table persists `attempts u8`, submit_answer accepts it, SprintPage counts and sends it, and check_and_unlock weights mastery by attempt quality (1st=1.0, 2nd=0.6, 3+=0.3).

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Add attempts field to Answer table and submit_answer reducer | ee7dcc7 | Done |
| 2 | Client tracks attempt count and sends it on correct submission | 94c74bd | Done |
| 3 | Learner model weights mastery by attempt count | 3cc87a6 | Done |

## What Was Built

### Task 1: Server Schema + Bindings

The `Answer` struct in `server/src/lib.rs` already had `attempts: u8` with `#[default(1)]` and `submit_answer` in `server/src/sprint.rs` already had the `attempts: u8` parameter and `attempts < 1` validation — the server changes were pre-existing on the branch.

`make generate` was run to regenerate TypeScript bindings, which updated `submit_answer_reducer.ts` to include `attempts: __t.u8()` and regenerated several new reducer binding files (restore_*, migrate_*) that had not been committed previously.

### Task 2: Client Attempt Tracking

`SprintPage.tsx` changes:
- Added `attemptCountRef = useRef(1)` near `problemStartRef`
- Updated `pendingAnswerRef` type to include `attempts: number`
- Increments `attemptCountRef.current += 1` in the wrong-answer branch of `doSubmit`
- Resets `attemptCountRef.current = 1` in three places: diagnostic first problem setup (effect 3c), `NextProblemResult` subscription update (effect 3d), and the correct-answer `setTimeout` callback for diagnostic problems
- Passes `attempts: attemptCountRef.current` in both the immediate `submitAnswer` call and the `pendingAnswerRef` queue for late-token submission

### Task 3: Weighted Mastery Formula

`check_and_unlock` in `server/src/lib.rs` (line ~716) now replaces the simple accuracy calculation:

```rust
// Before:
let acc = recent.iter().filter(|ans| ans.is_correct).count() as f32 / recent.len() as f32;
if acc >= 0.8 { mastered += 1; }

// After:
let weighted_acc: f32 = recent.iter().map(|ans| {
    if !ans.is_correct { 0.0 }
    else { match ans.attempts { 0 | 1 => 1.0, 2 => 0.6, _ => 0.3 } }
}).sum::<f32>() / recent.len() as f32;
if weighted_acc >= 0.8 { mastered += 1; }
```

`migrate_recompute_tiers` uses the same formula (applied to last-10 answers instead of last-3).

**Mastery thresholds (examples):**
- 3x first-attempt correct: 3.0/3 = 1.0 (mastered)
- 2x first + 1x second-attempt: 2.6/3 = 0.87 (mastered)
- 1x first + 2x second-attempt: 2.2/3 = 0.73 (NOT mastered)
- 3x second-attempt correct: 1.8/3 = 0.6 (NOT mastered)
- 3x third-attempt correct: 0.9/3 = 0.3 (NOT mastered)

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written.

### Notes

- The server (`lib.rs` and `sprint.rs`) already had the `attempts` field implemented on this branch. The plan called for adding them; they were already present. Treated as pre-existing work, verified compilation, then proceeded to bindings and client.
- `make generate` produced 8 new reducer binding files that had not been committed before; these were committed as part of Task 1 since they are generated output belonging to the codegen step.

## Verification

- Server compiles: `cargo build --target wasm32-unknown-unknown --release` — PASS (0.17s, no errors)
- Client compiles: `npx tsc --noEmit` — PASS (no output = no errors)
- Bindings in sync: `make generate` run in Task 1, no subsequent diff
- Answer struct has `attempts: u8` with `#[default(1)]`: confirmed in lib.rs lines 78-79
- submit_answer accepts `attempts` parameter: confirmed in sprint.rs lines 205-219
- SprintPage.tsx tracks `attemptCountRef`, increments on wrong, resets on new problem, sends on correct: confirmed
- check_and_unlock weights mastery: 1st=1.0, 2nd=0.6, 3+=0.3: confirmed in lib.rs

## Self-Check: PASSED

All committed files verified present. Commits ee7dcc7, 94c74bd, 3cc87a6 confirmed in git log.
