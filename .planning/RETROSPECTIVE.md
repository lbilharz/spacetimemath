# Retrospective: v1.0 — 1UP Math Sprint

**Shipped:** 2026-03-15
**Duration:** 2026-03-14 → 2026-03-15 (2 days)
**Phases:** 8 · **Plans:** 31 · **Commits:** ~84

---

## What We Built

Took a working but fragile classroom app and hardened it for safe public school use. Key security vectors closed, GDPR baseline established, scoring fixed, the codebase made maintainable, and account recovery made reliable. The app went from "works for a small group" to "trustworthy enough for real classrooms."

---

## Accomplishments

1. **Closed real attack surfaces** — private tables for credentials, per-session answer caps, 200ms bot guard, one-time problem tokens, server-owned sequencing. A student cannot cheat their score in any obvious way.

2. **GDPR baseline done right** — `delete_player` cascade removes everything; username-only data model maintained; right-to-erasure is a real reducer call, not a TODO.

3. **Account recovery actually works** — restore flow was broken before v1.0. Now: enter recovery code → server validates → credentials written to localStorage → reload. Teachers can re-download the full class code sheet at any time.

4. **Server owns the problem sequence** — biggest architectural win of the milestone. Before: client held the entire problem array and could read future problems. After: server deals one problem at a time via `next_problem` reducer. Human-verified via DevTools inspection during a live sprint.

5. **Subscription scoping closed the last data leak** — three sensitive result tables now deliver rows only to the owning identity. `consume_restore_result` shrinks the restore_results exposure window from disconnect-lifetime to seconds.

6. **Codebase is maintainable** — 1850-line lib.rs split into 6 focused modules with zero API changes. CSS design system replaces 100+ inline style props. New contributors can find things.

---

## What Went Well

- **Wave-based execution** — parallel plan execution worked well. Independent plans in the same phase ran simultaneously, keeping momentum high.
- **Human smoke tests as final gates** — automated tests caught code correctness; human DevTools inspection caught UX and security surface questions that tests couldn't. Both needed.
- **Write-to-table pattern for private data** — SpacetimeDB's constraint (no push to private tables) forced a clean pattern: server writes result to a public one-shot table, client reads it, consume reducer deletes it. Turned a limitation into a clear architecture.
- **Incremental server changes** — each phase added a clean delta to the schema. No `--break-clients` was needed after Phase 1.
- **Tier redesign** — moving from community-weighted difficulty to the explicit multiplier model (×1/×2/×10 → ... → ×9) gave players a clear sense of progression. Worth doing.

## What Was Harder Than Expected

- **SpacetimeDB 2.0.3 private table limitations** — three separate times we hit the same wall: private tables can't push rows to subscribers. Had to maintain hand-written bindings in index.ts because codegen deletes them on every `make generate`. A recurring paper cut.
- **Flaky class sprint integration test** — `triggers tier unlock after class sprint ends` fails sporadically with a 10s timeout on slow connections. Never fully diagnosed; left as known flaky.
- **ClassroomPage complexity** — 693 LOC, 88+ inline style occurrences, three rendering modes (idle/live/ended). The CSS migration plan was right to treat it as a separate wave.

---

## Patterns Established for v1.1

| Pattern | Use When |
|---------|----------|
| Write-to-public-result-table | Server needs to deliver one-shot data to a specific client (STDB 2.0.3) |
| Subscription scoping (`.where(r => r.field.eq(identity))`) | Sensitive per-user result tables |
| Consume-after-read | Any one-shot result that should be ephemeral |
| `hasFetchedRecoveryCodeRef` single-fire | Any data that should be fetched once per mount, not on every render cycle |
| Human DevTools gate | Security attack surface claims that automated tests can't fully verify |

---

## Deferred Debt — Priority for v1.1

1. **Replace `subscribeToAllTables()`** (SEC-11) — currently all connected clients receive all table data. Targeted subscriptions should be scoped per-user. Biggest remaining security surface.
2. **Fix hand-written module_bindings entries** — the `make generate` overwrite problem for private table types needs a solution (post-generate script or codegen config).
3. **Flaky integration test** — diagnose and fix the class sprint tier unlock test.
4. **Legal pages** (LEGAL-01–03) — Datenschutzerklärung, Impressum, DPA template. Needed before formal school partnerships.

---

## By the Numbers

| Metric | Value |
|--------|-------|
| Phases completed | 8/8 |
| Plans completed | 31/31 |
| Requirements shipped | 35 (SEC×10, GDPR×1, SCORE×3, CSS×4, UX×5, ACCT×2, SEQ×6, MOD×4) |
| Git commits | ~84 |
| Files changed | ~177 |
| Days | 2 (2026-03-14 → 2026-03-15) |
| Server deployments | Multiple (each phase with server changes) |
| Human smoke tests | 5 (Phase 1 end-to-end, Phase 3 UX, Phase 4 visual, Phase 5 restore flow, Phase 6 DevTools) |

---

*v1.0 retrospective written 2026-03-15*
*Next: `/gsd:new-milestone` to start v1.1*

---

## Milestone: v1.1 — Fixed Grid + Extended Tables

**Shipped:** 2026-03-17
**Duration:** 2026-03-16 → 2026-03-17 (2 days)
**Phases:** 2 (9–10) · **Plans:** 2 · **Commits:** 65

### What Was Built

Fixed a long-standing DotArray layout-shift bug (grid now always 10×10 regardless of problem), introduced ×11–×20 extended multiplication as a Master-tier opt-in with correct `digit_bonus` scoring, and shipped a cluster of quick-task improvements: logo refresh, inline display-name editing, masked recovery key, backup script, transfer-code removal.

### What Worked

- **Quick tasks as the real delivery vehicle** — the extended tables toggle UI (originally plan 10-02) was shipped earlier via quick tasks (260316-ily, 260317-8e1) before the plan was even executed. Dropping 10-02 was correct. Quick tasks are fast and produce no planning overhead when scope is clear.
- **Milestone audit caught stale state** — EXT-03 checkbox was `[ ]` but `digit_bonus` had been implemented in `sprint.rs:321`. Audit found this; milestone completion without audit would have logged a gap that didn't exist.
- **Schema migration worked cleanly** — adding `extended_mode: bool` to Player with `#[default(false)]` required only 4 files (lib.rs, sprint.rs, auth.rs, classroom.rs) and zero `--break-clients`. Rust's exhaustive struct construction forced all constructor sites to be updated at compile time.
- **Backup strategy delivered as a quick task** — not a planned phase but clearly needed after the `--delete-data` incident. The `/gsd:quick` workflow handled it well.

### What Was Inefficient

- **Plan 10-02 was dead on arrival** — the toggle UI was already shipped before plan 10-02 was ready to execute. The plan wasn't wrong, but quick tasks outran it. Could have tracked quick task outputs in the roadmap phase earlier.
- **No VERIFICATION.md for either phase** — both phases completed without formal Nyquist validation. Audit noted this. For small phases with single-file changes this is acceptable, but the pattern could drift into skipping verification on larger phases.
- **EXT-03 checkbox never updated after sprint.rs implementation** — minor housekeeping miss that surfaced as a false gap in milestone prep.

### Patterns Established

- **Quick tasks can fulfill plan requirements** — when a quick task delivers a plan's objective, drop the plan rather than re-executing redundantly. Use the audit to confirm coverage.
- **Class context ignores individual player preferences** — established for `extended_mode`: individual settings don't bleed into class sprints. Apply this pattern to any future player preferences.
- **`digit_bonus` scoring model** — 0.5 bonus when `max(a,b) ≥ 11`. Precedent set for how to handle non-standard difficulty in scoring.

### Key Lessons

1. **Ship the right thing, not the planned thing** — plan 10-02 specified AccountPage; reality evolved to ProgressPage (Adjust Level card). The right UX emerged from quick task iteration. Plans are starting assumptions, not binding contracts.
2. **Stale checkboxes create false gaps** — always update requirements traceability at the point of implementation, not at milestone completion. The milestone audit becomes a verification step, not a cleanup step.
3. **Two-phase milestones are fast** — 2 phases, 2 plans, 65 commits in 2 days. Most of the commit volume came from quick tasks. Small milestone scope kept focus high.

### Cost Observations

- Model mix: 100% sonnet (executor), sonnet (orchestrator) — no opus used this milestone
- Sessions: ~4 (one per major task cluster)
- Notable: Quick tasks dominated. GSD formal execution ran for 2 plans; remaining 63 commits were quick tasks and hotfixes. Ratio of planned vs unplanned work was ~1:30 by commit count.

*v1.1 retrospective written 2026-03-17*
*Next: `/gsd:new-milestone` to start v1.2*
