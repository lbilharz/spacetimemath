# Milestones

## v1.1 — Fixed Grid + Extended Tables

**Shipped:** 2026-03-17
**Phases:** 9–10 · **Plans:** 2 · **Commits:** 65
**Files changed:** 63 · **Net lines:** +5,127 / −1,070

### Delivered

Fixed the DotArray to always render a constant 10×10 grid with highlighted rectangle, eliminating layout shift. Introduced ×11–×20 multiplication as a server-side opt-in for Master-tier players, with proper `digit_bonus` scoring. Also shipped: logo refresh, inline display-name editing, masked recovery key reveal, backup strategy, and a cluster of quick-task UX improvements.

### Accomplishments

1. **VIZ-01/02** — DotArray always renders 100 cells; top-left a×b rectangle highlighted in yellow, remaining cells dimmed — no layout shift across problems
2. **EXT-01/02** — `Player.extended_mode` field + `set_extended_mode` reducer (tier-7 gate); `build_sequence` category-2 branch delivers ×11–×20 problems
3. **EXT-03** — `digit_bonus = 0.5` when `max(a,b) ≥ 11` in `finalize_session` — extended problems scored fairly
4. **Brand** — Noggin grid mark logo; inline profile-header display-name editing; masked recovery key with reveal toggle
5. **Backup** — `backup.sh` + `make backup` exports 8 durable tables to timestamped CSVs for production safety
6. **Transfer-code removal** — Deprecated transfer-code tables/reducers cleaned from server and client bindings

### Stats

| Metric | Value |
|--------|-------|
| Phases | 2 (9–10) |
| Plans | 2 |
| Commits | 65 |
| Files changed | 63 |
| Net lines | +5,127 / −1,070 |
| Duration | 2 days (2026-03-16 → 2026-03-17) |

### Archives

- `.planning/milestones/v1.1-ROADMAP.md`
- `.planning/milestones/v1.1-REQUIREMENTS.md`
- `.planning/milestones/v1.1-MILESTONE-AUDIT.md`

---

## v1.0 — Safe for School Rollout

**Shipped:** 2026-03-15
**Phases:** 1–8 · **Plans:** 31 · **Commits:** ~232
**Files changed:** 177 · **Lines added:** ~25,900

### Delivered

Took a working but fragile classroom app and hardened it for safe public school use. All security vectors closed, GDPR baseline established, scoring fixed, codebase made maintainable, account recovery made reliable.

### Accomplishments

1. **SEC-01–10** — Private tables for credentials, input validation, 200ms bot guard, one-time problem tokens; server owns problem sequencing, closing client foreknowledge cheating
2. **GDPR-01** — `delete_player` cascade reducer; right-to-erasure is a real call, not a TODO
3. **SCORE-01–03** — Class sprint sessions credited to leaderboard; 8-tier difficulty multiplier system (×1/×2/×10 → ×9)
4. **ACCT-03–04** — Account restore via recovery code fully working; teachers can download/print class login card sheets
5. **MOD-01–04** — 1850-line lib.rs split into 6 focused Rust modules (security, accounts, classroom, scoring, sessions, gdpr) with zero API changes
6. **SCOPE-01–03 + CONSUME-01** — Identity-scoped subscriptions + consume-after-read on sensitive one-shot result tables; last data-leak vector closed

### Stats

| Metric | Value |
|--------|-------|
| Phases | 8 |
| Plans | 31 |
| Commits | ~232 |
| Files changed | 177 |
| Lines added | ~25,900 |
| Duration | 2 days (2026-03-14 → 2026-03-15) |
| Server deployments | Multiple (each phase with server changes) |
| Human smoke tests | 5 |

### Archives

- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`

### Known Gaps

- `subscribeToAllTables()` still used (SEC-11 deferred to v1.1)
- Hand-written private table entries in `module_bindings/index.ts` overwritten by `make generate`
- Flaky integration test: `triggers tier unlock after class sprint ends`
- Legal pages not yet written (LEGAL-01–03)

---

*Add future milestones above this line.*
