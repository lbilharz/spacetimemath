# Roadmap: 1UP — Math Sprint

## Overview

This milestone hardens the app for safe public school rollout. A working app used by a small group becomes a trustworthy, secure, GDPR-baseline-compliant product. Security vulnerabilities are closed first (live data exposure and score manipulation vectors), then server-side scoring bugs and the right-to-erasure reducer are fixed, then client-side UX bugs are addressed, and finally inline styles are replaced with the design system. Every phase delivers a verifiable, observable improvement to the app's safety or quality.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Security Hardening** - Close live auth-token exposure and score-manipulation vectors server-side
- [ ] **Phase 2: Scoring Integrity and GDPR Baseline** - Fix leaderboard bugs, redesign tier structure, and add right-to-erasure reducer
- [ ] **Phase 3: UX and Client Bug Fixes** - Fix classroom page issues, recovery code instability, and account page clutter
- [ ] **Phase 4: CSS Design System Migration** - Replace all inline styles with design system classes for maintainability

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
**Plans**: TBD

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
**Plans**: TBD

### Phase 4: CSS Design System Migration
**Goal**: Every static visual style is expressed as a named CSS class; no inline style props remain except for runtime-computed values
**Depends on**: Nothing (independent; best done after Phase 1-3 files are stable)
**Requirements**: CSS-01, CSS-02, CSS-03, CSS-04
**Success Criteria** (what must be TRUE):
  1. index.css contains a utility class layer covering all recurring patterns (text color, font size, spacing, flex layout) used across the codebase
  2. Zero inline style={} props remain in client/src/components/ for static token values
  3. Zero inline style={} props remain in client/src/pages/ for static token values
  4. All pages are visually consistent — no outlier page differs in layout, spacing, typography, or color treatment
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 (Phase 4 can run in parallel with 2 and 3 if desired)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening | 2/5 | In Progress|  |
| 2. Scoring Integrity and GDPR Baseline | 0/? | Not started | - |
| 3. UX and Client Bug Fixes | 0/? | Not started | - |
| 4. CSS Design System Migration | 0/? | Not started | - |
