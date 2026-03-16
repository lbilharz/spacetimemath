# 1UP — Math Sprint

## What This Is

A real-time multiplayer multiplication trainer for school students. Players answer timed multiplication problems, earn difficulty-weighted scores, and unlock harder problem tiers as they improve. Teachers can run synchronized class sprints with live leaderboards. The app adapts to each player's mastery level and syncs live via SpacetimeDB.

## Core Value

Students practice multiplication facts in a fair, safe, adaptive environment — and the score they see reflects genuine mastery.

## Current Milestone: v1.1 — Fixed Grid + Extended Tables

**Goal:** Fix the DotArray visualization to always render at fixed size, and re-introduce two-digit multiplication as an opt-in feature for top-tier players.

**Target features:**
- Fixed 10×10 DotArray — same grid size for every problem, cells highlighted based on a×b
- Two-digit opt-in — Master-tier player toggle for ×11–×20 problems (server + client)

---

## Previous: v1.0 Shipped (2026-03-15)

**Status:** Safe for public school rollout. All security, GDPR baseline, UX, and scoring requirements met.

**What shipped in v1.0:**
- SEC-01–10: Private tables for credentials, input validation, 200ms bot guard, problem tokens
- GDPR-01: delete_player cascade reducer
- SCORE-01–03: Class sprint leaderboard credit + 8-tier multiplier system
- UX-01–05: Join code privacy, mobile layout, stable recovery codes
- CSS-01–04: Full design system migration (zero inline styles)
- ACCT-03–04: Account restore via recovery code + teacher download-codes button
- SEQ-01–06: Server owns problem sequencing — client foreknowledge attack surface closed
- MOD-01–04: 1850-line lib.rs split into 6 focused modules
- SCOPE-01–03 + CONSUME-01: Identity-scoped subscriptions + consume-after-read for sensitive result tables

**Known tech debt going into v1.1:**
- `subscribeToAllTables()` still used (targeted subscriptions deferred — SEC-11)
- Hand-written private table entries in module_bindings/index.ts (codegen overwrites on each make generate)
- Integration test `triggers tier unlock after class sprint ends` flaky on slow connections
- 15+ exhaustiveDeps disables in SprintPage (CONCERNS.md)

## Requirements

### Validated in v1.0

- ✓ Player registration with username (no email or real-name required)
- ✓ SpacetimeDB Identity-based auth with recovery key for device migration
- ✓ Adaptive problem selection weighted by community difficulty stats
- ✓ Difficulty-weighted scoring per sprint session
- ✓ Learning tier system (8 tiers, multiplier-based) with 80% mastery unlock gate
- ✓ Live leaderboard (best scores, all-time top players)
- ✓ Live online presence board
- ✓ Classroom mode: teacher creates rooms, students enroll via code
- ✓ Class sprints: teacher-triggered synchronized sessions with aggregate results
- ✓ Internationalization DE/EN with auto-detection
- ✓ iOS Capacitor app
- ✓ All reducer inputs validated server-side (types, ranges, ownership)
- ✓ Players cannot submit answers for sessions they don't own
- ✓ Score calculation happens server-side; client cannot inject scores
- ✓ Recovery codes stable and not trivially re-generated
- ✓ GDPR compliance posture: username-only, right to delete implemented
- ✓ Inline styles replaced with CSS classes
- ✓ Class sprint sessions counted in overall score / leaderboard
- ✓ Teacher join code hidden from students; mobile rendering fixed

### Active in v1.1

- [ ] Fixed 10×10 DotArray visualization (VIZ-01, VIZ-02)
- [ ] Two-digit multiplication opt-in at Master tier (EXT-01, EXT-02, EXT-03)

### Deferred to v1.2+

- Self-service account deletion UI (ACCT-01)
- Data transparency page (ACCT-02)
- Targeted subscriptions replacing subscribeToAllTables() (SEC-11)
- German legal pages: Datenschutzerklärung, Impressum, DPA (LEGAL-01–03)

### Out of Scope

- Arithmetic expansion (addition, subtraction, division, fractions) — after stable public launch
- New game mechanics — scope freeze until well-established in schools
- App Store / Play Store release — web-first
- OAuth or email-based login — SpacetimeDB Identity sufficient

## Context

- **Stack:** React + Vite + TypeScript (client), Rust WASM module on SpacetimeDB maincloud (server), Capacitor for iOS
- **Auth model:** No passwords; SpacetimeDB Identity (cryptographic keypair) + stored token. Recovery via 8-character code.
- **Data stored:** Username, learning tier, sprint history, answers (for adaptive selection). No email, no real name.
- **Target audience:** School students (minors) — triggers GDPR-K considerations even with minimal data
- **Current state:** v1.0 shipped. App used by a small group of students; hardened for broader school rollout.

## Constraints

- **Tech stack:** SpacetimeDB 2.0.3 WASM module — server code must compile to `wasm32-unknown-unknown`
- **SpacetimeDB limitation:** Private tables cannot receive row pushes from reducers — public result tables used for one-shot data delivery to clients
- **Data minimization:** No PII beyond username; must remain true post-cleanup
- **No breaking schema changes:** Any server change must be backward-compatible or published with `--break-clients` intentionally
- **Build pipeline:** `make deploy` = publish WASM + regenerate TS bindings; git hooks run lint + tests on commit

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SpacetimeDB Identity (no passwords) | Frictionless for kids; no email required; cryptographic identity | ✓ Good |
| Username-only registration | GDPR-K compliance; no parental consent needed | ✓ Good |
| Difficulty weights from community stats | Adaptive to actual player behavior | ⚠️ Revisit — tier redesign helps; community stats still drift |
| Recovery code (8-char) | Simple device migration without email | ✓ Fixed — restore flow stable in v1.0 |
| Class sprint scores excluded from leaderboard | Original intent unclear | ✓ Fixed — credit_session_to_player added |
| Public result tables for one-shot data | SpacetimeDB 2.0.3 cannot push private table rows | ✓ Accepted — tokens are short-lived; consume-after-read reduces exposure |
| Server owns problem sequencing | Closes client foreknowledge cheating vector | ✓ Validated by DevTools inspection |
| 6-file server module split | 1850-line monolith was unmaintainable | ✓ Good — domain isolation clear, no API changes |
| Teacher authority over student recovery codes | Kids on shared devices need teacher recovery path | ⚠️ Document risk clearly in UI — social engineering vector |

---
*Last updated: 2026-03-16 after v1.1 milestone started*
