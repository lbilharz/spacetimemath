# 1UP — Math Sprint

## What This Is

A real-time multiplayer multiplication trainer for school students. Players answer timed multiplication problems, earn difficulty-weighted scores, and unlock harder problem tiers as they improve. Teachers can run synchronized class sprints with live leaderboards. The app adapts to each player's mastery level and syncs live via SpacetimeDB. Master-tier players can opt into ×11–×20 extended tables for advanced practice.

## Core Value

Students practice multiplication facts in a fair, safe, adaptive environment — and the score they see reflects genuine mastery.

## Current State (v1.1 shipped 2026-03-17)

- **Stack:** React + Vite + TypeScript (client), Rust WASM module on SpacetimeDB maincloud (server), Capacitor for iOS
- **Auth model:** No passwords; SpacetimeDB Identity (cryptographic keypair) + stored token. Recovery via 8-character code.
- **Data stored:** Username, learning tier, sprint history, answers (for adaptive selection), extended_mode flag. No email, no real name.
- **Target audience:** School students (minors) — triggers GDPR-K considerations even with minimal data
- **Status:** v1.1 shipped. Fixed-grid visualization + extended tables opt-in delivered. App used by a small group of students; hardened for broader school rollout.

## Requirements

### Validated in v1.0

- ✓ Player registration with username (no email or real-name required) — v1.0
- ✓ SpacetimeDB Identity-based auth with recovery key for device migration — v1.0
- ✓ Adaptive problem selection weighted by community difficulty stats — v1.0
- ✓ Difficulty-weighted scoring per sprint session — v1.0
- ✓ Learning tier system (8 tiers, multiplier-based) with 80% mastery unlock gate — v1.0
- ✓ Live leaderboard (best scores, all-time top players) — v1.0
- ✓ Live online presence board — v1.0
- ✓ Classroom mode: teacher creates rooms, students enroll via code — v1.0
- ✓ Class sprints: teacher-triggered synchronized sessions with aggregate results — v1.0
- ✓ Internationalization DE/EN with auto-detection — v1.0
- ✓ iOS Capacitor app — v1.0
- ✓ All reducer inputs validated server-side (types, ranges, ownership) — v1.0
- ✓ Players cannot submit answers for sessions they don't own — v1.0
- ✓ Score calculation happens server-side; client cannot inject scores — v1.0
- ✓ Recovery codes stable and not trivially re-generated — v1.0
- ✓ GDPR compliance posture: username-only, right to delete implemented — v1.0
- ✓ Inline styles replaced with CSS classes — v1.0
- ✓ Class sprint sessions counted in overall score / leaderboard — v1.0
- ✓ Teacher join code hidden from students; mobile rendering fixed — v1.0

### Validated in v1.1

- ✓ Fixed 10×10 DotArray visualization — no layout shift across problems (VIZ-01, VIZ-02) — v1.1
- ✓ Two-digit multiplication opt-in at Master tier (EXT-01, EXT-02, EXT-03) — v1.1

### Active in v1.2+

- [ ] Self-service account deletion UI (ACCT-01)
- [ ] Data transparency page (ACCT-02)
- [ ] Targeted subscriptions replacing subscribeToAllTables() (SEC-11)
- [ ] German legal pages: Datenschutzerklärung, Impressum, DPA (LEGAL-01–03)

### Out of Scope

- Arithmetic expansion (addition, subtraction, division, fractions) — after stable public launch
- New game mechanics — scope freeze until well-established in schools
- App Store / Play Store release — web-first
- OAuth or email-based login — SpacetimeDB Identity sufficient

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
| Class sprints ignore individual extended_mode | Class context must be uniform; teachers run standard sessions | ✓ Good — extended mode is a solo-practice feature only |
| Extended tables UI on ProgressPage not AccountPage | UX fit better in "Adjust Level" card where tier context is visible | ✓ Good — discovered during quick tasks, correct placement |
| Client-side toggle UI deferred (plan 10-02 dropped) | Server-side extended_mode already wired; toggle implemented via quick tasks | ✓ Accepted — feature fully delivered via quick tasks before plan executed |

## Known Tech Debt (entering v1.2)

- `subscribeToAllTables()` still used (SEC-11 deferred)
- Hand-written private table entries in `module_bindings/index.ts` overwritten by `make generate`
- Flaky integration test: `triggers tier unlock after class sprint ends`
- Legal pages not yet written (LEGAL-01–03)
- Nyquist validation not run for Phases 9–10 (no VERIFICATION.md files)

---
*Last updated: 2026-03-17 after v1.1 milestone*
