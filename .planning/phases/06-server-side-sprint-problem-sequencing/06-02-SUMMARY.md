---
phase: 06-server-side-sprint-problem-sequencing
plan: "02"
subsystem: server + client-bindings
tags: [sequencing, server, rust, codegen, gdpr]
dependency_graph:
  requires: [06-01]
  provides: [SprintSequence table, NextProblemResult table, next_problem reducer, TS bindings]
  affects: [start_session, start_class_sprint, finalize_session, delete_player]
tech_stack:
  added: []
  patterns:
    - Fisher-Yates shuffle with FNV-1a hash chain (deterministic per session+sender)
    - Single-pass commutative-pair adjacency fix after shuffle
    - try_insert return-value pattern to capture auto_inc session id
    - Upsert (find/update or insert) for NextProblemResult, same as IssuedProblemResult
    - SpacetimeDB codegen skips private tables (sprint_sequences not generated)
key_files:
  created:
    - client/src/module_bindings/next_problem_results_table.ts
    - client/src/module_bindings/next_problem_reducer.ts
  modified:
    - server/src/lib.rs
    - client/src/module_bindings/index.ts
    - client/src/module_bindings/types.ts
    - client/src/module_bindings/types/reducers.ts
decisions:
  - "SprintSequence is private (no public attribute) — codegen correctly skips it; only NextProblemResult needs to be public for row-push subscriptions"
  - "start_session rewritten to capture Ok(inserted) from try_insert rather than checking .is_ok() — needed to get the auto_inc session id for SprintSequence insert"
  - "make generate produces next_problem_results_table.ts not next_problem_result_type.ts — SpacetimeDB codegen uses _table.ts suffix for table row types"
  - "fnv_index incorporates session_id into hash so two players starting sessions at the same microsecond get different sequences"
  - "commutative_of_a cast uses u16 arithmetic (b1 as u16 * 100 + a1 as u16) to avoid u8 overflow for large factor values"
metrics:
  duration: "~3 min"
  completed_date: "2026-03-15"
  tasks_completed: 2
  files_changed: 6
---

# Phase 6 Plan 02: Server-Side Sprint Sequencing — Implementation Summary

Server-side sprint sequencing: SprintSequence + NextProblemResult tables, FNV-1a Fisher-Yates build_sequence, next_problem reducer, and integration into all 4 call sites (start_session, start_class_sprint, finalize_session, delete_player). TS bindings regenerated.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add SprintSequence + NextProblemResult tables, fnv_index, build_sequence, next_problem reducer | 2a1a666 | server/src/lib.rs |
| 2 | Wire build_sequence into 4 integration points; regenerate TS bindings | e0c8081 | server/src/lib.rs, 5 binding files |

## What Was Built

### New Tables (server/src/lib.rs)

**SprintSequence** (private — never pushed to client):
- `session_id: u64` — primary key (natural, no auto_inc)
- `player_identity: Identity`
- `sequence: String` — comma-separated problem_keys (e.g. "302,203,405,...")
- `index: u32` — pointer to next problem to serve

**NextProblemResult** (public — required for SpacetimeDB 2.0.3 row-push):
- `owner: Identity` — primary key
- `session_id: u64`
- `a: u8`, `b: u8`
- `token: String`

### New Functions

**fnv_index(sender, ts, session_id, i)**: FNV-1a hash mixing sender bytes + timestamp + session_id + draw index. Used as Fisher-Yates swap target generator.

**build_sequence(ctx, session_id, player_tier)**: Collects all eligible problem_stats pairs (a!=0, b!=0, tier <= player_tier), Fisher-Yates shuffles using fnv_index, then fixes commutative-pair adjacency in a single forward pass. Returns comma-separated string.

**next_problem reducer**: Validates session ownership + completeness, reads SprintSequence for session, parses keys, picks key[index], increments index, issues IssuedProblem token (SEC-10 pattern), upserts NextProblemResult.

### Integration Points Updated

- **start_session**: Rewrote `.is_ok()` check to `if let Ok(inserted)` to capture session id; inserts SprintSequence after successful session insert.
- **start_class_sprint**: Same pattern in member loop — captures each `inserted_sess.id` per student.
- **finalize_session**: Deletes SprintSequence row at session end (before score computation).
- **delete_player**: Step 2b — deletes sprint_sequences rows for all player session_ids before session deletion (SEQ-06 GDPR cascade).

### TS Bindings Regenerated

`make generate` produced:
- `client/src/module_bindings/next_problem_results_table.ts` — NextProblemResult row type
- `client/src/module_bindings/next_problem_reducer.ts` — nextProblem reducer arg type
- `client/src/module_bindings/index.ts` — updated: nextProblemResults table + next_problem reducer registered

SprintSequence correctly skipped (private table — codegen log: "Skipping private tables during codegen: ..., sprint_sequences, ...").

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `cargo build --target wasm32-unknown-unknown`: Finished without errors
- `npm test -- --run src/utils/`: 2 test files, 42 tests passed
- `make generate`: Succeeded; all 3 expected binding paths present in index.ts

## Self-Check: PASSED

Files confirmed present:
- server/src/lib.rs — contains SprintSequence, NextProblemResult, next_problem, build_sequence
- client/src/module_bindings/next_problem_results_table.ts — created
- client/src/module_bindings/next_problem_reducer.ts — created
- client/src/module_bindings/index.ts — contains nextProblemResults, next_problem

Commits confirmed:
- 2a1a666 feat(06-02): add SprintSequence + NextProblemResult tables...
- e0c8081 feat(06-02): wire build_sequence into start_session...
