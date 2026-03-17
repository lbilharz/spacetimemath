# Incident: Production Data Wipe — 2026-03-17

## What happened

`spacetime publish --delete-data spacetimemath` was run manually (not via `make publish`), wiping all production data from maincloud: 46 players, 591 sessions, 4,651 answers.

## Root cause

The `--delete-data` flag is a destructive option on `spacetime publish` that clears all table data before deploying. Running it manually bypassed the safe `make publish` target which intentionally omits this flag.

## Recovery

Full restore was completed same day with 0 failures using three scripts:

| Script | What it does |
|--------|-------------|
| `restore.js` | Restores Player rows, recovery keys, and computed best_score rows |
| `restore-history.js` | Restores all Session and Answer rows |
| `compute-tiers.js` | Recomputes learning tiers from session history and calls `set_learning_tier` |

Data source: CSV exports from SpacetimeDB maincloud web console (downloaded before the wipe when we noticed the problem).

The restore reducers in the server are idempotent — safe to re-run.

## Prevention

1. **Always use `make publish` or `make deploy`** — never raw `spacetime publish --delete-data`
2. **Export data before any schema-breaking publish**: use the SpacetimeDB web console → Tables → Export CSV for `players`, `sessions`, `answers`, `recovery_keys`
3. **The restore reducers are kept in the server as a safety net** — they're idempotent and caller-scoped (you can only restore your own identity)

## Restore reducers (server)

- `restore_player_full` — upsert Player row (auth.rs)
- `restore_recovery_key` — replace recovery key (security.rs)
- `restore_session` — insert session by original ID (lib.rs)
- `restore_answer` — insert answer by original ID (lib.rs)
- `restore_best_score` — upsert BestScore row (lib.rs)
