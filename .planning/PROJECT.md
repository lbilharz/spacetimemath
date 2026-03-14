# 1UP — Math Sprint

## What This Is

A real-time multiplayer multiplication trainer for school students. Players answer timed multiplication problems, earn difficulty-weighted scores, and unlock harder problem tiers as they improve. Teachers can run synchronized class sprints with live leaderboards. The app adapts to each player's mastery level and syncs live via SpacetimeDB.

## Core Value

Students practice multiplication facts in a fair, safe, adaptive environment — and the score they see reflects genuine mastery.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — inferred from existing codebase -->

- ✓ Player registration with username (no email or real-name required) — existing
- ✓ SpacetimeDB Identity-based auth with recovery key for device migration — existing
- ✓ Adaptive problem selection weighted by community difficulty stats — existing
- ✓ Difficulty-weighted scoring per sprint session — existing
- ✓ Learning tier system (Tier 0→3) with 80% mastery unlock gate — existing
- ✓ Live leaderboard (best scores, all-time top players) — existing
- ✓ Live online presence board (who's currently playing) — existing
- ✓ Classroom mode: teacher creates rooms, students enroll via code — existing
- ✓ Class sprints: teacher-triggered synchronized sessions with aggregate results — existing
- ✓ Internationalization DE/EN with auto-detection — existing
- ✓ iOS Capacitor app — existing

### Active

<!-- Safe-for-public-launch milestone: security, cleanup, bug fixes -->

#### Security
- [ ] All reducer inputs validated server-side (types, ranges, ownership)
- [ ] Players cannot submit answers for sessions they don't own
- [ ] Score calculation happens server-side; client cannot inject scores
- [ ] Recovery and session codes are stable and not trivially re-generated
- [ ] Data minimization confirmed: no PII beyond username stored or transmitted
- [ ] GDPR compliance posture documented (username-only, no tracking, right to delete)

#### Code Quality
- [ ] Inline styles replaced with CSS classes and reusable components
- [ ] Dead code and unused features removed
- [ ] Consistent patterns across all pages (layout, spacing, component use)
- [ ] No visual inconsistencies between pages

#### Bug Fixes
- [ ] Class sprint sessions counted in overall score / leaderboard
- [ ] Problem difficulty rating matches player expectations
- [ ] Account page no longer shows redundant classroom list
- [ ] ClassroomPage hides login code from students; mobile rendering fixed; redundant "view class results" variant removed

### Out of Scope

- Arithmetic expansion (addition, subtraction, division, fractions) — next milestone after launch
- New game mechanics or features — scope freeze until safe-for-public goal achieved
- App Store / Play Store release — web-first launch first
- OAuth or email-based login — SpacetimeDB Identity sufficient for school use

## Context

- **Stack:** React + Vite + TypeScript (client), Rust WASM module on SpacetimeDB maincloud (server), Capacitor for iOS
- **Auth model:** No passwords; SpacetimeDB Identity (cryptographic keypair) + stored token. Recovery via 8-character code.
- **Data stored:** Username, learning tier, sprint history, answers (for adaptive selection). No email, no real name.
- **Target audience:** School students (minors) — triggers GDPR-K considerations even with minimal data
- **Current state:** Working app used by a small group; needs security hardening and cleanup before broader school rollout
- **Known fragility:** `CONCERNS.md` documents 15+ exhaustive-deps disables, large components (ClassroomPage 693 LOC, SprintPage 599 LOC), and mutable global auth token export

## Constraints

- **Tech stack:** SpacetimeDB 2.0.3 WASM module — server code must compile to `wasm32-unknown-unknown`
- **Data minimization:** No PII beyond username; must remain true post-cleanup
- **No breaking schema changes:** Any server change must be backward-compatible or published with `--break-clients` intentionally
- **Build pipeline:** `make deploy` = publish WASM + regenerate TS bindings; git hooks run lint + tests on commit

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SpacetimeDB Identity (no passwords) | Frictionless for kids; no email required; cryptographic identity | ✓ Good |
| Username-only registration | GDPR-K compliance; no parental consent needed | ✓ Good |
| Difficulty weights from community stats | Adaptive to actual player behavior, not curated guesses | ⚠️ Revisit — reported mismatch with user expectations |
| Recovery code (8-char) | Simple device migration without email | ⚠️ Revisit — reported as fragile, regenerated too easily |
| Class sprint scores excluded from leaderboard | Original intent unclear | ⚠️ Revisit — reported as bug, should count |

---
*Last updated: 2026-03-14 after initialization*
