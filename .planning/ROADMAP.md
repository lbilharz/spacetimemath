# Roadmap: 1UP — Math Sprint

## Overview

This milestone hardens the app for safe public school rollout. A working app used by a small group becomes a trustworthy, secure, GDPR-baseline-compliant product. Security vulnerabilities are closed first (live data exposure and score manipulation vectors), then server-side scoring bugs and the right-to-erasure reducer are fixed, then client-side UX bugs are addressed, and finally inline styles are replaced with the design system. Every phase delivers a verifiable, observable improvement to the app's safety or quality.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Security Hardening** - Close live auth-token exposure and score-manipulation vectors server-side (completed 2026-03-14)
- [ ] **Phase 2: Scoring Integrity and GDPR Baseline** - Fix leaderboard bugs, redesign tier structure, and add right-to-erasure reducer
- [x] **Phase 3: UX and Client Bug Fixes** - Fix classroom page issues, recovery code instability, and account page clutter (completed 2026-03-14)
- [x] **Phase 4: CSS Design System Migration** - Replace all inline styles with design system classes for maintainability (completed 2026-03-15)
- [x] **Phase 5: Account Recovery and Classroom Code Management** - Fix broken account restore flow and enable teachers to re-download student recovery codes at any time (completed 2026-03-15)

## Phase Details

### Phase 1: Security Hardening
**Goal**: No user can read another user's auth credentials, scores cannot be trivially inflated, and all reducer inputs are validated against ownership and ranges
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08, SEC-09, SEC-10
**Success Criteria** (what must be TRUE):
  1. A logged-in player cannot read any other player's recovery key or transfer code by subscribing to those tables
  2. The AccountPage successfully displays a player's own recovery code after the table-to-reducer migration
  3. Submitting answers faster than 200ms, exceeding 80 answers in a session, or with an out-of-tier problem pair is rejected by the server
  4. Registering or updating a username containing null bytes, control characters, or Unicode homoglyphs is rejected by the server
  5. Transfer codes expire automatically and cannot be reused after their TTL; a server-issued problem token prevents answer submission for unissued problems
**Plans**: 5 plans

Plans:
- [ ] 01-01-PLAN.md — Wave 0 test scaffold: security.test.ts + helpers.ts update
- [ ] 01-02-PLAN.md — Client-first SEC-03: AccountPage reducer-based access for recovery/transfer codes
- [ ] 01-03-PLAN.md — Server hardening: private tables (SEC-01, SEC-02), use_transfer_code fix (SEC-07), username validation (SEC-08), scheduled TTL (SEC-09)
- [ ] 01-04-PLAN.md — submit_answer hardening: answer cap (SEC-04), response_ms bounds (SEC-05), tier validation (SEC-06)
- [ ] 01-05-PLAN.md — Server-issued problem token: IssuedProblem tables, issue_problem reducer, SprintPage integration (SEC-10)

### Phase 2: Scoring Integrity and GDPR Baseline
**Goal**: Class sprint participation counts toward the leaderboard, the tier structure matches player expectations, and any player can request full deletion of their account data
**Depends on**: Phase 1
**Requirements**: SCORE-01, SCORE-02, SCORE-03, GDPR-01
**Success Criteria** (what must be TRUE):
  1. A student who only participates in class sprints sees their best score on the leaderboard after the sprint finalizes
  2. Class sprint completion triggers tier unlock evaluation — a student can unlock a new tier from a class sprint session
  3. The tier progression (×1/×2/×10 → ×3 → ×5 → ×4 → ×6 → ×7 → ×8 → ×9) is reflected in problem selection and unlock gates
  4. Calling the delete_player reducer removes all data linked to the calling identity (player, sessions, answers, scores, online presence, keys, classroom memberships)
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — Wave 1: Test scaffolds for SCORE-01, SCORE-02, SCORE-03, GDPR-01 (scoring.test.ts, gdpr.test.ts, learningTier.test.ts)
- [ ] 02-02-PLAN.md — Wave 2: Class sprint score credit — credit_session_to_player helper + finalize_class_sprint_sessions fix (SCORE-01, SCORE-02)
- [ ] 02-03-PLAN.md — Wave 2: Tier structure redesign — 8-tier factor_tier + migrate_recompute_tiers_v2 + learningTier.ts update (SCORE-03)
- [ ] 02-04-PLAN.md — Wave 2: delete_player cascade reducer (GDPR-01)

### Phase 3: UX and Client Bug Fixes
**Goal**: The classroom page works correctly on mobile and shows teachers the join code but not students; the account page is uncluttered; recovery codes remain stable across sessions
**Depends on**: Phase 1
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05
**Success Criteria** (what must be TRUE):
  1. The account page does not show a classroom list
  2. A student viewing the ClassroomPage cannot see the join/login code; a teacher can see it
  3. The ClassroomPage renders without layout breakage on a mobile viewport
  4. There is exactly one "view class results" path in ClassroomPage — the redundant variant is gone
  5. Navigating away from and back to the account page (or reconnecting) does not generate a new recovery code
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — Wave 1: AccountPage cleanup — remove classroom section (UX-01), move recovery code fetch to App.tsx (UX-05)
- [ ] 03-02-PLAN.md — Wave 1: ClassroomPage fixes — hide join code from students (UX-02), mobile layout (UX-03), active-sprint-only live feed (UX-04)
- [ ] 03-03-PLAN.md — Wave 2: Human verification checkpoint for all five UX fixes

### Phase 4: CSS Design System Migration
**Goal**: Every static visual style is expressed as a named CSS class; no inline style props remain except for runtime-computed values
**Depends on**: Nothing (independent; best done after Phase 1-3 files are stable)
**Requirements**: CSS-01, CSS-02, CSS-03, CSS-04
**Success Criteria** (what must be TRUE):
  1. index.css contains a utility class layer covering all recurring patterns (text color, font size, spacing, flex layout) used across the codebase
  2. Zero inline style={} props remain in client/src/components/ for static token values
  3. Zero inline style={} props remain in client/src/pages/ for static token values
  4. All pages are visually consistent — no outlier page differs in layout, spacing, typography, or color treatment
**Plans**: 5 plans

Plans:
- [ ] 04-01-PLAN.md — Wave 1: Utility class layer in index.css (CSS-01)
- [ ] 04-02-PLAN.md — Wave 2: Migrate all 9 components (CSS-02)
- [ ] 04-03-PLAN.md — Wave 2: Migrate 8 pages — all except ClassroomPage (CSS-03)
- [ ] 04-04-PLAN.md — Wave 3: Migrate ClassroomPage — largest file, 88 occurrences (CSS-03)
- [ ] 04-05-PLAN.md — Wave 4: Human visual verification — all 9 pages desktop + mobile (CSS-04)

### Phase 5: Account Recovery and Classroom Code Management
**Goal**: Teachers can re-download the student recovery code sheet from ClassroomPage at any time, and any student who has a recovery code can successfully restore their account session on a new device or shared device
**Depends on**: Phase 1 (private table architecture)
**Requirements**: ACCT-03, ACCT-04
**Success Criteria** (what must be TRUE):
  1. A new anonymous connection entering a valid recovery code on RegisterPage is redirected to the original account (session token returned via server-side reducer, no private table lookup client-side)
  2. A teacher on ClassroomPage can click "Download codes" at any time and receive a printable/saveable sheet of all student names and their recovery codes
**Plans**: 4 plans

Plans:
- [ ] 05-01-PLAN.md — Wave 1: Server tables + reducers (RestoreResult, restore_account, ClassRecoveryResult, get_class_recovery_codes) + integration test stubs (ACCT-03, ACCT-04)
- [ ] 05-02-PLAN.md — Wave 2: Client bindings + RegisterPage restore flow (ACCT-03)
- [ ] 05-03-PLAN.md — Wave 2: Client bindings + ClassroomPage Download codes button (ACCT-04)
- [ ] 05-04-PLAN.md — Wave 3: Automated checks + human smoke test (ACCT-03, ACCT-04)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening | 5/5 | Complete   | 2026-03-14 |
| 2. Scoring Integrity and GDPR Baseline | 3/4 | In Progress|  |
| 3. UX and Client Bug Fixes | 3/3 | Complete   | 2026-03-14 |
| 4. CSS Design System Migration | 5/5 | Complete   | 2026-03-15 |
| 5. Account Recovery and Classroom Code Management | 4/4 | Complete   | 2026-03-15 |

### Phase 6: Server-side sprint problem sequencing

**Goal:** The server generates and owns the full problem sequence for each normal sprint — the client never receives future problems, closing the client-side foreknowledge cheating vector
**Requirements**: SEQ-01, SEQ-02, SEQ-03, SEQ-04, SEQ-05, SEQ-06
**Depends on:** Phase 5
**Plans:** 1/4 plans executed

Plans:
- [ ] 06-01-PLAN.md — Wave 1: Test scaffolds — sprint_sequencing.test.ts (SEQ-01 to SEQ-05 stubs) + gdpr.test.ts SEQ-06 stub
- [ ] 06-02-PLAN.md — Wave 2: Server — SprintSequence + NextProblemResult tables, build_sequence fn, next_problem reducer, cascade updates, make generate
- [ ] 06-03-PLAN.md — Wave 3: Client — SprintPage server-driven flow + implement SEQ-01 to SEQ-06 integration tests
- [ ] 06-04-PLAN.md — Wave 4: Deploy to maincloud + human smoke test (DevTools inspection)
