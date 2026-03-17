---
phase: quick-260317-b5d
plan: 01
subsystem: server
tags: [cleanup, schema-change, deploy, transfer-code]
dependency_graph:
  requires: [quick-260317-au1]
  provides: [clean-server-schema, clean-client-bindings]
  affects: [server/src/lib.rs, server/src/security.rs, server/src/gdpr.rs, client/src/module_bindings/]
tech_stack:
  added: []
  patterns: [spacetime-publish-delete-data-on-conflict]
key_files:
  created: []
  modified:
    - server/src/lib.rs
    - server/src/security.rs
    - server/src/gdpr.rs
    - client/src/module_bindings/index.ts
  deleted:
    - client/src/module_bindings/create_transfer_code_reducer.ts
    - client/src/module_bindings/use_transfer_code_reducer.ts
    - client/src/module_bindings/transfer_code_results_table.ts
decisions:
  - "Used --delete-data=on-conflict for spacetime publish to handle dropping three transfer-code tables"
metrics:
  duration: ~12min
  completed: 2026-03-17
---

# Phase quick-260317-b5d Plan 01: Remove Transfer-Code Tables and Reducers Summary

**One-liner:** Removed TransferCode, TransferCodeResult, TransferCodeCleanupSchedule tables and all three transfer-code reducers from the server, then redeployed with --delete-data=on-conflict; client bindings auto-cleaned.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Remove transfer-code symbols from server source | 00db28e | server/src/lib.rs, server/src/security.rs, server/src/gdpr.rs |
| 2 | Deploy and clean client bindings | 576c7a8 | client/src/module_bindings/ (3 files deleted, index.ts regenerated) |

## What Was Done

**Task 1 — Server source cleanup:**
- Removed `pub use security::expire_transfer_codes` re-export from `lib.rs`
- Removed `TransferCode`, `TransferCodeResult`, `TransferCodeCleanupSchedule` table structs from `lib.rs`
- Removed `TRANSFER_CODE_TTL_MICROS`, `TRANSFER_CODE_CLEANUP_INTERVAL_MICROS` constants from `lib.rs`
- Removed the cleanup scheduler init block from the `init` reducer in `lib.rs`
- Removed `create_transfer_code`, `use_transfer_code`, `expire_transfer_codes` reducers from `security.rs`
- Removed all transfer-code import references from `security.rs` and `gdpr.rs`
- Removed the `transfer_codes`/`transfer_code_results` deletion blocks from `delete_player` in `gdpr.rs`
- WASM build verified clean with zero errors

**Task 2 — Deploy and bind cleanup:**
- `make publish` failed with standard `-y` flag (breaking schema change requires `--delete-data`)
- Ran `spacetime publish` manually with `--delete-data=on-conflict -y` — succeeded, cleared live DB
- Ran `make generate` — codegen prompted to delete 3 transfer-code files interactively; deleted manually
- Verified: no transfer_code files or references in `client/src/module_bindings/`
- Client unit tests: 44/44 pass
- Integration tests: all failures are expected BinaryReader schema-change disconnect errors (SpacetimeDB 2.0.3 artifact after breaking publish)

## Decisions Made

- **--delete-data=on-conflict:** SpacetimeDB CLI requires this flag when dropping tables. The standard `-y` flag does not override the manual-migration guard for table removals. Used `--delete-data=on-conflict` to allow the schema change and clear affected table data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Publish required --delete-data=on-conflict flag**
- **Found during:** Task 2
- **Issue:** `make publish` (which uses `-y` only) failed with "Removing the table X requires a manual migration" for all three transfer-code tables
- **Fix:** Ran `spacetime publish` directly with `--delete-data=on-conflict -y` instead of `make deploy`; then ran `make generate` and integration tests separately
- **Files modified:** None (Makefile unchanged per plan scope)
- **Note:** Plan anticipated this possibility and gave exact guidance; treated as expected deviation

**2. [Rule 3 - Blocking] Codegen did not auto-delete stale binding files**
- **Found during:** Task 2
- **Issue:** `spacetime generate` listed 3 transfer-code files for deletion but prompted interactively (non-TTY environment) and left them
- **Fix:** Deleted `create_transfer_code_reducer.ts`, `use_transfer_code_reducer.ts`, `transfer_code_results_table.ts` manually with `rm`
- **Files modified:** client/src/module_bindings/ (3 files removed)

## Self-Check: PASSED

- server/src/lib.rs: no transfer_code references (grep confirmed)
- server/src/security.rs: no transfer_code references (grep confirmed)
- server/src/gdpr.rs: no transfer_code references (grep confirmed)
- client/src/module_bindings/: no transfer_code files or references (grep + ls confirmed)
- Commit 00db28e: exists
- Commit 576c7a8: exists
- Unit tests: 44/44 passed
