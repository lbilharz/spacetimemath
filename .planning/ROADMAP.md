# Roadmap: 1UP — Math Sprint

## Milestones

- ✅ **v1.0 Safe for School Rollout** - Phases 1-8 (shipped 2026-03-15)
- 🚧 **v1.1 Fixed Grid + Extended Tables** - Phases 9-10 (in progress)

---

## v1.0 — Safe for School Rollout ✅ SHIPPED 2026-03-15

8 phases · 31 plans · SEC/GDPR/CSS/UX/ACCT/SEQ/MOD/SCOPE complete → [full archive](.planning/milestones/v1.0-ROADMAP.md)

---

## v1.1 — Fixed Grid + Extended Tables 🚧

**Milestone Goal:** Fix the DotArray visualization to always render at fixed size, and re-introduce two-digit multiplication as an opt-in feature for top-tier players.

### Phases

- [ ] **Phase 9: Fixed Grid Visualization** - Update DotArray to always render a 10×10 grid with highlighted rectangle
- [ ] **Phase 10: Extended Tables Opt-In** - Server flag + client toggle for Master-tier ×11–×20 problems

## Phase Details

### Phase 9: Fixed Grid Visualization
**Goal**: Players see a consistent 10×10 dot grid for every problem, with the current multiplication highlighted as a rectangle
**Depends on**: Phase 8 (v1.0 complete)
**Requirements**: VIZ-01, VIZ-02
**Success Criteria** (what must be TRUE):
  1. For any problem a×b, the dot grid always renders with exactly 10 columns and 10 rows (never larger or smaller)
  2. The top-left a×b rectangle of dots is visually highlighted, with the remaining dots in a neutral/background state
  3. The grid dimensions do not shift or resize as the player advances through different problems
**Plans**: 1 plan

Plans:
- [ ] 09-01-PLAN.md — Rewrite DotArray.tsx to fixed 10×10 grid with a×b rectangle highlight

### Phase 10: Extended Tables Opt-In
**Goal**: Master-tier players can toggle two-digit multiplication on, and the server delivers ×11–×20 problems when the flag is active
**Depends on**: Phase 9
**Requirements**: EXT-01, EXT-02, EXT-03
**Success Criteria** (what must be TRUE):
  1. A Master-tier player sees an "extended tables" toggle in their account settings; players below Master tier do not see it
  2. When the toggle is turned on, subsequent problems include one factor in the range 11–20
  3. When the toggle is turned off, problems return to the standard 1–10 range
  4. Extended problems display a score using the same tier multiplier system as standard problems
**Plans**: TBD

Plans:
- [ ] 10-01: Add `extended_mode` field to Player table and `set_extended_mode` reducer; deploy with `make deploy`
- [ ] 10-02: Branch `next_problem` server logic on `extended_mode` flag; client toggle in AccountPage/ProgressPage

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-8. v1.0 phases | v1.0 | 31/31 | Complete | 2026-03-15 |
| 9. Fixed Grid Visualization | v1.1 | 0/1 | Not started | - |
| 10. Extended Tables Opt-In | v1.1 | 0/2 | Not started | - |
