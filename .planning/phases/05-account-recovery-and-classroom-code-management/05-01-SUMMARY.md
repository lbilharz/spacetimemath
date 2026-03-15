---
phase: 05-account-recovery-and-classroom-code-management
plan: "01"
subsystem: server
tags: [spacetimedb, rust, private-tables, reducers, account-recovery, classroom]
dependency_graph:
  requires: []
  provides: [restore_account-reducer, get_class_recovery_codes-reducer, RestoreResult-table, ClassRecoveryResult-table]
  affects: [client/src/__tests__/integration/account_recovery.test.ts]
tech_stack:
  added: []
  patterns: [write-to-private-table, anonymous-caller-reducer, teacher-scoped-multi-row-result]
key_files:
  created:
    - client/src/__tests__/integration/account_recovery.test.ts
  modified:
    - server/src/lib.rs
decisions:
  - "restore_account does NOT call get_player() — caller is anonymous with no player row"
  - "restore_account length-checks 12 chars and normalises to uppercase before lookup"
  - "identity_disconnected cleans up RestoreResult rows as belt-and-suspenders measure"
  - "ClassRecoveryResult uses member_identity as primary key — each student can only have one recovery code; teacher batch replace is delete-then-insert"
  - "Integration tests for private table row delivery are it.skip pending Plan 02/03 bindings — same pattern as SEC-03 in security.test.ts"
metrics:
  duration: "3 min"
  completed_date: "2026-03-15"
  tasks_completed: 3
  files_changed: 2
---

# Phase 5 Plan 01: Server Tables, Reducers, and Test Stubs Summary

**One-liner:** Two new SpacetimeDB private tables (RestoreResult, ClassRecoveryResult) and two reducers (restore_account, get_class_recovery_codes) deployed to maincloud, plus integration test scaffolding.

## What Was Built

### Task 1: RestoreResult table and restore_account reducer (6e52fd5)

Added to `server/src/lib.rs`:

- `RestoreResult` private table (ACCT-03): keyed by `caller: Identity`, holds `token: String`. No `public` attribute — private table.
- `restore_account` reducer: anonymous-caller compatible (no `get_player()` call), normalises input to uppercase, length-checks 12 chars, looks up `recovery_keys.code()`, upserts RestoreResult row.
- Cleanup in `identity_disconnected`: `ctx.db.restore_results().caller().delete(ctx.sender())` removes stale rows when anonymous callers disconnect.

### Task 2: ClassRecoveryResult table and get_class_recovery_codes reducer (98cd5a3)

Added to `server/src/lib.rs`:

- `ClassRecoveryResult` private table (ACCT-04): keyed by `member_identity: Identity`, stores `teacher_identity`, `classroom_id`, `username`, `code`. One row per student.
- `get_class_recovery_codes` reducer: verifies caller is classroom teacher, deletes all stale rows for that teacher, then inserts fresh rows for each classroom member that has a recovery key.
- Module published to maincloud (`spacetimemath` database) via `make publish`.

### Task 3: Integration test stubs (284f033)

Created `client/src/__tests__/integration/account_recovery.test.ts`:

- ACCT-03 describe block: 3 tests — valid code (it.skip, private table limitation), unknown 12-char code (active, rejects.toThrow), invalid length (active, rejects.toThrow)
- ACCT-04 describe block: 3 tests — result rows for members (it.skip), non-teacher error (active, rejects.toThrow), stale row replacement (it.skip)
- File parses cleanly; unit test suite passes (37 tests, 0 errors)
- Private-table delivery tests are it.skip pending Plan 02/03 client bindings — same documented limitation as SEC-03

## Verification

- WASM build: `cargo build --target wasm32-unknown-unknown` — `Finished` with no errors
- `make publish` — deployed to maincloud, both new tables confirmed created (`restore_results`, `class_recovery_results`)
- Unit test suite: 37/37 pass

## Decisions Made

1. **Anonymous caller pattern**: `restore_account` skips `get_player()` entirely. The caller has no player row — the reducer must proceed directly to `recovery_keys` lookup.
2. **Code normalisation and length guard**: uppercase + 12-char check in reducer for defence in depth, even though UI already enforces this.
3. **ClassRecoveryResult primary key**: `member_identity` is sufficient — each student belongs to a teacher's batch; delete-all-for-teacher + re-insert makes duplicates impossible.
4. **Identity_disconnected cleanup**: Added `restore_results` cleanup to prevent orphaned rows from accumulating for anonymous identities that disconnect before reading the result.
5. **Integration test skip pattern**: Tests that depend on private table row delivery to the calling client are it.skip, consistent with the SEC-03 skip in security.test.ts, pending SpacetimeDB version upgrade or confirmed working bindings in Plan 02/03.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `server/src/lib.rs` contains `pub struct RestoreResult` — FOUND
- `server/src/lib.rs` contains `pub struct ClassRecoveryResult` — FOUND
- `server/src/lib.rs` contains `pub fn restore_account` — FOUND
- `server/src/lib.rs` contains `pub fn get_class_recovery_codes` — FOUND
- `identity_disconnected` contains `restore_results().caller().delete` — FOUND (line 197)
- `client/src/__tests__/integration/account_recovery.test.ts` exists — FOUND (217 lines)
- Commits 6e52fd5, 98cd5a3, 284f033 — CONFIRMED
