# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Better 1UP** is a real-time multiplayer multiplication trainer. Players work through adaptive problem sequences, earn scores weighted by difficulty, and unlock tiers as mastery improves. Classrooms let teachers run group sprints with live leaderboards.

**Stack:** React 19 + TypeScript (Vite) frontend, Rust SpaceTimeDB module (WASM) backend, real-time sync via WebSocket subscriptions.

## Commands

### Client (in `client/`)
```bash
npm run dev               # Dev server at http://localhost:5173
npm run build             # TypeScript check + Vite production build
npm run test              # Unit tests (Vitest)
npm run test:integration  # Integration tests against live SpaceTimeDB
npm run lint              # ESLint
npm run lint:i18n         # Verify all translation keys are present across 8 languages
```

### Server & Deploy (from repo root)
```bash
make publish              # Build WASM + publish to maincloud (non-interactive, CI-safe)
make generate             # Regenerate TypeScript bindings from server schema
make deploy               # publish + generate + integration tests
make backup               # Export durable tables to recovery/backups/
make call REDUCER=<name>  # Call any reducer on maincloud
make wipe-and-publish     # DESTRUCTIVE: wipe all data then publish (requires confirmation)
```

### Server (manual, in `server/`)
```bash
~/.cargo/bin/cargo build --target wasm32-unknown-unknown --release
```

## Architecture

### Client–Server Connection
SpaceTimeDB is both the database and the server. The client connects via WebSocket (`wss://maincloud.spacetimedb.com`, database `spacetimemath`). Tables are subscribed to reactively — no REST API. All server logic lives in Rust reducers; the client only calls reducers and reads table subscriptions.

Auth is tokenless from the user's perspective: SpaceTimeDB generates a token on first connect, stored in `localStorage` under `spacetimemath_credentials`. Recovery keys (stored in a private `recovery_keys` table) allow account migration.

### Key Data Flow
1. `main.tsx` builds a `DbConnection` (with optional saved token) and wraps the app in `<SpacetimeDBProvider>`
2. `App.tsx` subscribes to the `players` table, waits for the local player row, then routes to the appropriate page
3. Pages call reducers (e.g., `start_session()`, `submit_answer()`) and react to table updates
4. There is no Redux or React Context for app state — SpaceTimeDB subscriptions are the source of truth

### Navigation
Custom SPA routing via `window.history.pushState` (see `navigation.ts` + `useAppNavigation` hook). Pages: `register`, `lobby`, `classrooms`, `progress`, `sprint`, `results`, `account`, `classroom`, `classsprintresults`. No React Router.

### Sprint Anti-Cheat
The server pre-generates a private `sprint_sequences` table per session. The client calls `next_problem(session_id)` to get one problem at a time, receiving a short-lived token. The token must be returned with `submit_answer()` — this prevents answer swapping or replay attacks.

### Learning Tier System
8 tiers (0–7) that progressively unlock multiplication pairs. Tier advancement requires 80% accuracy on the current tier's pairs. Tier 7 (Master) unlocks extended mode (×11–×20). Core logic: `client/src/utils/learningTier.ts` and `server/src/lib.rs`.

### Private Tables Workaround
SpaceTimeDB 2.0.3 cannot push rows to private tables. Short-lived "result" tables (e.g., `recovery_code_results`, `issued_problem_results`) are marked public but contain data only briefly. The actual secrets (`recovery_keys`) remain in a strict private table.

### Internationalization
`i18next` with 8 languages: `en`, `de`, `fr`, `nl`, `tr`, `uk`, `ar`, `zh`. Arabic sets `dir="rtl"` on the document root. Auto-detected from browser, persisted in localStorage. Run `npm run lint:i18n` after adding any new translation keys.

### TypeScript Rule
No `any` types. Use proper interfaces, `unknown` with type guards, or add a comment explaining why `any` is unavoidable.

## Key Files

| File | Purpose |
|------|---------|
| `client/src/App.tsx` | Root: SpaceTimeDB init, page routing, class sprint detection |
| `client/src/navigation.ts` | Page enum + URL path mappings |
| `client/src/pages/SprintPage.tsx` | Sprint timer, problem delivery, scoring |
| `client/src/pages/ClassroomPage.tsx` | Teacher/student classroom views, group sprint UI |
| `client/src/utils/learningTier.ts` | Tier unlock logic |
| `server/src/lib.rs` | Schema, table definitions, init, migrations |
| `server/src/sprint.rs` | Sprint reducers (start, next_problem, submit_answer, finalize) |
| `server/src/classroom.rs` | Classroom & group sprint reducers |
| `server/src/auth.rs` | Registration, recovery, tier setup |
| `Makefile` | All deploy automation |

## Schema Changes

Any change to the server schema requires `make wipe-and-publish` (destructive — drops all data) or a migration reducer. Schema changes disconnect all active clients. When adding new columns/tables, add a migration reducer in `server/src/lib.rs` rather than wiping production data.
