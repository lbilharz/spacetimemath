# Milestones

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
