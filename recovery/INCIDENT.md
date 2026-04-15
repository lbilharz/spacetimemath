# Production Data Incidents

---

## Incident 2: Production Data Wipe — 2026-04-14

### What happened

`spacetime publish --delete-data spacetimemath` was run, wiping all production data:
~88 players, ~828 sessions, ~6,298 answers, ~11 classrooms, ~45 classroom members.

### Root cause

Same as Incident 1: raw `spacetime publish --delete-data` run outside of `make publish`.
The `wipe-and-publish` Makefile guard did not prevent a direct CLI invocation.

### Recovery

A `make backup` run at 08:04 UTC had captured all durable tables. Full restore was
completed same day.

**What was restored:**

| Step | Command | Tables |
|------|---------|--------|
| 1 | `node recovery/restore-from-backup.js` | players, recovery_keys, best_scores, classrooms, sessions, answers |
| 2 | Bootstrap admin in SpacetimeDB console | (manual: add caller to `server_admins`) |
| 3 | `node recovery/restore-memberships.js` | classroom_members |

**What was NOT restored** (regenerates from gameplay, or low priority):

- `problem_stats`, `kc_telemetry` — rebuilt automatically from ongoing gameplay
- `friendships`, `friend_invites` — not yet scripted; players re-added manually
- `class_sprints`, `player_secrets`, `teacher_secrets`, `player_dkt_weights`, `unlock_logs` — not yet scripted; class sprint history is non-critical

### What changed as a result

- `restore-from-backup.js` written: single-script 6-phase restore from pipe-delimited `make backup` output (replaces the three separate scripts from Incident 1)
- `restore-memberships.js` written: admin-gated classroom member restore
- `admin_restore_membership_for` reducer added (classroom.rs)
- `admin_set_player_type` reducer added (auth.rs)
- `backup.sh` expanded to cover all durable tables (previously missed `player_secrets`, `player_dkt_weights`, `unlock_logs`, `server_admins`, `teacher_secrets`, `friendships`, `friend_invites`, `kc_telemetry`, `class_sprints`)

### Prevention

Same rules as Incident 1. Additionally:

- `backup.sh` now covers all durable tables — run `make backup` before every publish
- Run `make backup` immediately after a successful deploy to capture a clean baseline

---

## Incident 1: Production Data Wipe — 2026-03-17

### What happened

`spacetime publish --delete-data spacetimemath` was run manually (not via `make publish`),
wiping all production data: 46 players, 591 sessions, 4,651 answers.

### Root cause

The `--delete-data` flag is a destructive option on `spacetime publish` that clears all
table data before deploying. Running it manually bypassed the safe `make publish` target
which intentionally omits this flag.

### Recovery

Full restore was completed same day with 0 failures using three scripts
(now superseded by `restore-from-backup.js` from Incident 2):

| Script | What it did |
|--------|------------|
| `restore.js` | Restored Player rows, recovery keys, and BestScore rows |
| `restore-history.js` | Restored all Session and Answer rows |
| `compute-tiers.js` | Recomputed learning tiers and called `set_learning_tier` |

Data source: CSV exports from SpacetimeDB maincloud web console.

### Prevention

1. Always use `make publish` or `make deploy` — never raw `spacetime publish --delete-data`
2. Export data before any schema-breaking publish
3. The restore reducers are kept in the server as a safety net — idempotent and caller-scoped
