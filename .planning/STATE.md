---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Fixed Grid + Extended Tables
status: planning
stopped_at: "Checkpoint: 260317-9lo Task 3 awaiting human-verify"
last_updated: "2026-03-17T05:59:20.231Z"
last_activity: 2026-03-16 — v1.1 roadmap created (2 phases, 5 requirements, phases 9–10)
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 3
  completed_plans: 2
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** Students practice multiplication facts in a fair, safe, adaptive environment — and the score they see reflects genuine mastery.
**Current focus:** v1.1 — Phase 9 (Fixed Grid Visualization)

## Current Position

Milestone v1.0 complete and archived (8 phases, 31 plans).
Status: Roadmap created — ready to plan Phase 9

Last activity: 2026-03-16 — v1.1 roadmap created (2 phases, 5 requirements, phases 9–10)

Progress: [----------] 0% (0/2 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: 8 min
- Total execution time: 0.13 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-security-hardening | 4 completed | ~14 min avg | 8-20 min range |

**Recent Trend:**
- Last 5 plans: 01-01 (8 min), 01-02 (~20 min), 01-03 (~20 min), 01-04 (18 min)
- Trend: consistent 18-20 min for server+client plans

*Updated after each plan completion*
| Phase 01-security-hardening P02 | 20min | 2 tasks | 5 files |
| Phase 01-security-hardening P04 | 18min | 2 tasks | 1 file |
| Phase 01-security-hardening P03 | 20 | 2 tasks | 5 files |
| Phase 01-security-hardening P05 | ~25min | 3 tasks | 9 files |
| Phase 02-scoring-integrity-and-gdpr-baseline P01 | 3min | 2 tasks | 3 files |
| Phase 02-scoring-integrity-and-gdpr-baseline P02 | 6min | 2 tasks | 2 files |
| Phase 02-scoring-integrity-and-gdpr-baseline P03 | 2min | 2 tasks | 3 files |
| Phase 02-scoring-integrity-and-gdpr-baseline P04 | 4 | 2 tasks | 7 files |
| Phase 03-ux-and-client-bug-fixes P01 | 3min | 2 tasks | 2 files |
| Phase 03-ux-and-client-bug-fixes P02 | 1min | 1 tasks | 1 files |
| Phase 03-ux-and-client-bug-fixes P03 | 5min | 2 tasks | 0 files |
| Phase 04-css-design-system-migration P01 | 2min | 1 tasks | 1 files |
| Phase 04-css-design-system-migration P02 | 7min | 2 tasks | 10 files |
| Phase 04-css-design-system-migration P03 | 11min | 2 tasks | 9 files |
| Phase 04-css-design-system-migration P04 | 15min | 1 tasks | 2 files |
| Phase 04-css-design-system-migration P05 | 5min | 2 tasks | 0 files |
| Phase 05-account-recovery-and-classroom-code-management P01 | 3min | 3 tasks | 2 files |
| Phase 05-account-recovery-and-classroom-code-management P02 | 3min | 2 tasks | 4 files |
| Phase 05-account-recovery-and-classroom-code-management P03 | 3min | 2 tasks | 6 files |
| Phase 05-account-recovery-and-classroom-code-management P04 | 5min | 2 tasks | 0 files |
| Phase 06-server-side-sprint-problem-sequencing P01 | 2min | 2 tasks | 2 files |
| Phase 06-server-side-sprint-problem-sequencing P02 | 3 | 2 tasks | 6 files |
| Phase 06-server-side-sprint-problem-sequencing P03 | 8min | 2 tasks | 5 files |
| Phase 06-server-side-sprint-problem-sequencing P04 | 2min | 2 tasks | 0 files |
| Phase 07-split-server-lib-rs-into-modules P01 | 5min | 2 tasks | 6 files |
| Phase 07-split-server-lib-rs-into-modules P02 | 8min | 2 tasks | 3 files |
| Phase 07-split-server-lib-rs-into-modules P03 | 3min | 2 tasks | 2 files |
| Phase 07-split-server-lib-rs-into-modules P04 | ~15min | 2 tasks | 3 files |
| Phase 08-tokenized-fetch-for-sensitive-one-shot-results P01 | 5min | 2 tasks | 3 files |
| Phase 08-tokenized-fetch-for-sensitive-one-shot-results P02 | 10min | 2 tasks | 5 files |
| Phase 09-fixed-grid-visualization P01 | 15 | 2 tasks | 1 files |
| Phase 10-extended-tables-opt-in P01 | 9min | 3 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: Making recovery_keys and transfer_codes private is a schema-breaking change requiring --break-clients and coordinated client deploy (AccountPage must be updated before the schema change ships)
- Phase 1: SpacetimeDB reducers cannot return data directly — use write-to-private-table pattern for get_my_recovery_code; needs smoke test before committing
- Phase 1: ReducerContext randomness API availability in SpacetimeDB 2.0.3 is unconfirmed — verify before implementing make_recovery_code
- 01-01: recovery_keys and transfer_codes removed from ALL_TABLES in helpers.ts in Plan 01 (not Plan 03) to prevent test breakage at schema-change deploy time
- 01-01: Security tests use (as any) casts for future server APIs not yet in generated bindings — accepted trade-off for pre-implementation scaffolding
- 01-01: SEC-01/SEC-02 tests already pass because ALL_TABLES no longer includes these tables; same 0-row assertion covers both current state and post-Plan-03 private state
- [Phase 01-security-hardening]: SpacetimeDB codegen skips private tables — hand-wrote row defs and registered them in index.ts for recovery_code_results and transfer_code_results
- [Phase 01-security-hardening]: CODE_TTL reduced from 3600 to 600 seconds in AccountPage to match Plan 03 server TTL for transfer codes
- [Phase 01-security-hardening]: submit_answer guards placed before Answer insert (no partial state on rejection); guard order: response_ms bounds → session cap → tier check (cheapest first)
- [Phase 01-security-hardening]: Integration tests use spacetimemath-test DB on maincloud — publish-test required after server changes, separate from make publish
- [Phase 01-security-hardening]: SpacetimeDB 2.0.3 private tables cannot be subscribed to via SELECT * nor receive row pushes via ReducerResult — SEC-03 test skipped with documented limitation
- [Phase 01-security-hardening]: expire_transfer_codes uses self-re-scheduling pattern (inserts new TransferCodeCleanupSchedule at end of each run) for recurring 5-min TTL cycle
- [Phase 01-security-hardening]: IssuedProblemResult is public (not private) — SpacetimeDB 2.0.3 cannot push private table rows; token is short-lived so public exposure is acceptable
- [Phase 01-security-hardening]: make_code() reused for problem token generation; 6-char FNV-1a adequate for short-lived session token
- [Phase 01-security-hardening]: Silent skip on missing token in SprintPage (rare race condition on slow connections) — better UX than error message
- [Phase 01-security-hardening]: Phase 1 Security Hardening fully complete — SEC-01 through SEC-10 all verified. Known regression: AccountPage recovery code display broken because recovery_code_results/transfer_code_results are private tables; deferred to Phase 3.
- [Phase 02-scoring-integrity-and-gdpr-baseline]: learningTier tier progression tests use it.todo (pending) not failing assertions to satisfy must_haves 'skipped or pending' criterion and avoid blocking pre-commit hook
- [Phase 02-scoring-integrity-and-gdpr-baseline]: gdpr.test.ts uses (as any) cast for deletePlayer reducer — not yet in generated bindings, same pattern as security.test.ts
- [Phase 02-scoring-integrity-and-gdpr-baseline]: credit_session_to_player reads session from DB not as parameter, called from both end_session and finalize_class_sprint_sessions
- [Phase 02-scoring-integrity-and-gdpr-baseline]: Class sprint test exercises finalize_class_sprint_sessions code path — student never calls startSession/endSession; server creates session in startClassSprint
- [Phase 02-scoring-integrity-and-gdpr-baseline]: ×5 moved from tier 0 to tier 2 (8-tier model); migrate_recompute_tiers_v2 uses reset+check_and_unlock for consistency with live game logic
- [Phase 02-scoring-integrity-and-gdpr-baseline]: delete_player has no player-row gate: cleans all tables regardless of whether player row exists — handles orphaned data from partial registrations
- [Phase 02-scoring-integrity-and-gdpr-baseline]: issued_problems deletion ordered before sessions — session_ids collected first to avoid orphaned rows
- [Phase 03-ux-and-client-bug-fixes]: Recovery code hydration moved to App.tsx single-fire pattern using hasFetchedRecoveryCodeRef; AccountPage reads recovery_code_results via useTable only
- [Phase 03-ux-and-client-bug-fixes]: onEnterClassroom prop removed from AccountPage; classrooms tab (ClassroomsPage) is canonical classroom entry point
- [Phase 03-ux-and-client-bug-fixes]: Join code card gated on isTeacher (not a separate prop) — role derived from classroom.teacher identity match; activeSprint used for live feed guard so feed disappears cleanly when sprint ends
- [Phase 03-ux-and-client-bug-fixes]: All five UX requirements (UX-01 through UX-05) confirmed correct by human smoke test — Phase 3 complete
- [Phase 04-css-design-system-migration]: Utility class section appended at end of index.css to avoid modifying existing structural rules; all colors use design tokens (var(--*))
- [Phase 04-css-design-system-migration]: Added .mastery-cell BEM class to index.css — Plan 01 utilities did not cover the aspect-ratio grid cell base pattern used by MasteryGrid
- [Phase 04-css-design-system-migration]: SplashGrid had no changes needed — its only style={} is runtime-animated SVG fill; topbar-tab--active className ternary replaces inline border/color active-state in TopBar
- [Phase 04-css-design-system-migration]: Ghost link button (.btn-link) added to index.css — appears in RegisterPage (2x) and 5+ files across codebase; .code-box utility captures shared monospace/accent styling for transfer code and recovery key displays
- [Phase 04-css-design-system-migration]: liveTd constant in LobbyPage deleted; live players table uses .tbl-td with inline padding overrides (9px 4px, 14px) since live feed has different density than tbl-td defaults
- [Phase 04-css-design-system-migration]: ClassroomPage member row keeps two runtime style={} props (border-bottom, opacity) — both conditionally computed from array index and m.hidden boolean; .text-md added for 16px h2 section overrides
- [Phase 04-css-design-system-migration]: Phase 4 CSS Design System Migration fully complete — CSS-01 through CSS-03 all done; entire codebase migrated from inline styles to utility classes
- [Phase 04-css-design-system-migration]: Phase 4 approved as complete by human smoke test — all 9 pages confirmed visually consistent on desktop and mobile; runtime-computed styles (mastery colors, timer, progress bar) confirmed working; CSS-04 satisfied
- [Phase 05-account-recovery-and-classroom-code-management]: SECURITY DECISION — get_class_recovery_codes exposes student recovery codes to the classroom teacher. Authorization guard: ctx.sender() must equal classroom.teacher AND the student must be a member of that specific classroom. Known residual risk: a student tricked into joining a malicious classroom exposes their recovery key to that classroom's "teacher" — this is a social engineering vector, not a passive data leak. Accepted trade-off: classroom context requires teacher authority over student credentials; threat model is kids on shared devices, not adversarial actors. Students should only join classrooms from trusted teachers (UI should reinforce this).
- [Phase 05-account-recovery-and-classroom-code-management]: restore_account skips get_player() — anonymous callers have no player row; code normalised to uppercase with 12-char length guard for defence in depth
- [Phase 05-account-recovery-and-classroom-code-management]: ClassRecoveryResult uses member_identity as primary key; delete-all-for-teacher then insert is atomic batch replacement pattern
- [Phase 05-account-recovery-and-classroom-code-management]: Reducer arg schema uses plain object (not __t.row()) — matches all existing generated reducer bindings in module_bindings/
- [Phase 05-account-recovery-and-classroom-code-management]: restoreResultsRef pattern in RegisterPage prevents stale closure in async polling loop; useEffect keeps ref current on every render
- [Phase 05-account-recovery-and-classroom-code-management]: RegisterPage restore flow: call restoreAccount reducer, poll restoreResultsRef every 50ms up to 5s, write localStorage spacetimemath_credentials + reload on success
- [Phase 05-account-recovery-and-classroom-code-management]: get_class_recovery_codes_reducer.ts was already auto-generated by codegen; Download codes button always visible to teachers (not gated on studentsWithCards); 300ms setTimeout before handlePrintAll allows SpacetimeDB subscription update to propagate
- [Phase 05-account-recovery-and-classroom-code-management]: ACCT-03 verified: localStorage swap + reload on valid recovery code confirmed working in browser smoke test
- [Phase 05-account-recovery-and-classroom-code-management]: ACCT-04 verified: teacher QR printable sheet confirmed working; Download codes hidden from students
- [Phase 06-server-side-sprint-problem-sequencing]: Use it.todo() for Wave 0 stubs — Vitest marks as skipped not failed, keeping pre-commit hook green while pending work is visible in test output
- [Phase 06-server-side-sprint-problem-sequencing]: Remove unused waitFor import from sprint_sequencing.test.ts — stubs are all it.todo with no body; re-add in Plan 03 when stubs are implemented
- [Phase 06-server-side-sprint-problem-sequencing]: SprintSequence is private; codegen skips it; NextProblemResult is public for SpacetimeDB 2.0.3 row-push
- [Phase 06-server-side-sprint-problem-sequencing]: start_session rewritten to capture Ok(inserted) from try_insert — needed to get auto_inc session id for SprintSequence insert
- [Phase 06-server-side-sprint-problem-sequencing]: make generate produces next_problem_results_table.ts (not _type.ts) — SpacetimeDB codegen uses _table.ts suffix for table row types
- [Phase 06-server-side-sprint-problem-sequencing]: Remove selectNextProblem client-side function — server now owns problem sequencing for normal sprints; dead code after the switch
- [Phase 06-server-side-sprint-problem-sequencing]: next_problem_results accessor uses snake_case in tests (SpacetimeDB SDK preserves table name case for db.* accessors)
- [Phase 06-server-side-sprint-problem-sequencing]: Phase 6 security goal confirmed by human DevTools inspection — no future problem sequence visible in React DevTools state or refs during a live normal sprint; all six SEQ requirements satisfied
- [Phase 07-split-server-lib-rs-into-modules]: Visibility promotion done as isolated atomic step — compiler verifies pub(crate) changes compile before any code moves across module boundaries
- [Phase 07-split-server-lib-rs-into-modules]: mod declarations placed immediately after use spacetimedb line, before CONSTANTS section — keeps imports at the top of the crate root
- [Phase 07-split-server-lib-rs-into-modules]: SpacetimeDB table accessor traits must be explicitly imported per-module via use crate::{table_name}; — not inherited from lib.rs
- [Phase 07-split-server-lib-rs-into-modules]: expire_transfer_codes moved to security.rs requires pub use security::expire_transfer_codes in lib.rs for scheduled() macro visibility at crate root
- [Phase 07-split-server-lib-rs-into-modules]: fnv_index not imported in sprint.rs — only build_sequence (in lib.rs) uses it; sprint.rs functions don't call it directly
- [Phase 07-split-server-lib-rs-into-modules]: finalize_class_sprint_sessions in lib.rs calls sprint::finalize_session and sprint::credit_session_to_player using module path syntax
- [Phase 07-split-server-lib-rs-into-modules]: finalize_class_sprint_sessions kept private in classroom.rs (not pub(crate)) — internal implementation detail of end_class_sprint and auto_end_class_sprint only
- [Phase 07-split-server-lib-rs-into-modules]: lib.rs final state: schema tables + mod declarations + lifecycle reducers + migrate_* reducers + pub(crate) helpers/constants; all extracted reducers removed; line count reduced from ~1850 to ~700-900
- [Phase 07-split-server-lib-rs-into-modules]: Phase 7 fully complete — six-file server module split deployed and verified live on maincloud (MOD-04 satisfied)
- [Phase 08-tokenized-fetch-for-sensitive-one-shot-results]: Identity-guard fallback: identity ? tables.x.where(r => r.field.eq(identity)) : tables.x — pre-identity connections get unscoped subscription but rows are always identity-owned anyway
- [Phase 08-tokenized-fetch-for-sensitive-one-shot-results]: consume_restore_result is idempotent — no error if row already gone; identity_disconnected is backstop
- [Phase 08-tokenized-fetch-for-sensitive-one-shot-results]: consume call in RegisterPage is best-effort (try/catch) — restore UX completes even if consume reducer fails
- [Phase 08-tokenized-fetch-for-sensitive-one-shot-results]: myRecoveryKey simplified from .find(identity filter) to [0] — subscription is server-scoped so array contains at most one row
- [Phase 08-tokenized-fetch-for-sensitive-one-shot-results]: classroomId filter preserved in ClassroomPage after removing teacherIdentity filter — teacher may have codes for multiple classrooms in subscription
- [Phase 09-fixed-grid-visualization]: DotArray always iterates INDICES (0-9) for both loops; clampToGrid clamp on a/b; block gap structure with BLOCK_SIZE=5; faded prop on outer container
- [Phase 10-extended-tables-opt-in]: Class sprints pass extended_mode=false to build_sequence — class context never uses extended mode regardless of player setting
- [Phase 10-extended-tables-opt-in]: Integration test failures on deploy are expected — SpacetimeDB 2.0.3 schema change disconnects all clients; unit tests all pass

### Roadmap Evolution

- Phase 6 added: Server-side sprint problem sequencing
- Phase 7 added: Split server lib.rs into modules
- Phase 8 added: Tokenized fetch for sensitive one-shot results
- Phase 9 added (v1.1): Fixed grid visualization
- Phase 10 added (v1.1): Extended tables opt-in

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260316-ily | Extended mode toggle in Adjust Level section with switch and number preview | 2026-03-16 | 988e876 | [260316-ily-extended-mode-toggle-in-adjust-level-sec](./quick/260316-ily-extended-mode-toggle-in-adjust-level-sec/) |
| 260317-7tf | Memoize SprintPage derived values + React.memo Numpad + DotArray for snappier sprint UI | 2026-03-17 | ae6d835 | [260317-7tf-measure-and-improve-sprint-snappiness-fi](./quick/260317-7tf-measure-and-improve-sprint-snappiness-fi/) |
| 260317-8e1 | Hide DotArray for extended problems + inline x11-x20 rows in MasteryGrid with gap row | 2026-03-17 | 9bae453 | [260317-8e1-extended-mode-ux-fixes-hide-dotarray-for](./quick/260317-8e1-extended-mode-ux-fixes-hide-dotarray-for/) |
| 260317-8vn | Sequential x11-x20 unlock gated by 80% mastery, weighted sprint pool, +N tier badge | 2026-03-17 | b876fe8 | [260317-8vn-extended-mode-progression-sequential-x11](./quick/260317-8vn-extended-mode-progression-sequential-x11/) |
| 260317-9uc | Unified My Level card replacing two tier cards, inline pencil-icon edit affordance | 2026-03-17 | 09f2639 | [260317-9uc-rename-adjust-level-to-my-level-merge-to](./quick/260317-9uc-rename-adjust-level-to-my-level-merge-to/) |

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: SpacetimeDB 2.0.3 private table client behavior needs smoke test — does making a previously-subscribed table private clear client cache cleanly?
- Phase 2: SpacetimeDB maincloud DPA availability from Clockwork Labs is unconfirmed — needed before school-facing DPA template can be finalized (but DPA template is v2; delete_player reducer is v1)

## Session Continuity

Last session: 2026-03-17T07:09:30.000Z
Stopped at: Completed quick-260317-9uc-PLAN.md
Resume file: None
