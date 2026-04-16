# Roadmap: 1UP — Math Sprint

## Milestones

- ✅ **v1.0 Safe for School Rollout** — Phases 1–8 (shipped 2026-03-15)
- ✅ **v1.1 Fixed Grid + Extended Tables** — Phases 9–10 (shipped 2026-03-17)
- 🔄 **v1.2 App Store Submission** — Phases 11–15 (in progress)

---

## Phases

<details>
<summary>✅ v1.0 Safe for School Rollout (Phases 1–8) — SHIPPED 2026-03-15</summary>

8 phases · 31 plans · SEC/GDPR/CSS/UX/ACCT/SEQ/MOD/SCOPE complete → [full archive](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Fixed Grid + Extended Tables (Phases 9–10) — SHIPPED 2026-03-17</summary>

- [x] Phase 9: Fixed Grid Visualization (1/1 plans) — completed 2026-03-16
- [x] Phase 10: Extended Tables Opt-In (1/1 plans) — completed 2026-03-17

[full archive](milestones/v1.1-ROADMAP.md)

</details>

## v1.2 App Store Submission (Phases 11–15)

**Goal:** Get Better 1UP approved in the App Store by fixing privacy dealbreakers, then introduce class-scoped identity for school use.

- [x] Phase 11: Remove Global Leaderboard UI (completed 2026-03-30)
  **Goal:** Remove all global leaderboard surfaces from the app so no child's pseudonym is visible to strangers. Sprint leaderboard scoped to class participants only. Unblocks App Store submission.
  **Requirements:** APP-01, APP-02
  **Plans:** 2 plans
  Plans:
  - [ ] 11-01-PLAN.md — Remove global leaderboard source code (LobbyPage, ResultsPage, App.tsx, delete Leaderboard.tsx)
  - [ ] 11-02-PLAN.md — i18n cleanup (remove leaderboard keys, update tagline across 9 locales)

- [ ] Phase 12: Database cleanup
  **Goal:** General database cleanup and refactoring.
  **Requirements:** TBD

- [ ] Phase 13: Class-Scoped Username Uniqueness
  **Goal:** Enforce username uniqueness per class (not globally) server-side. Add player_type, class_id, email fields to players table. Solo → Teacher / Solo → Student transitions via reducers. SuS → Teacher blocked server-side.
  **Requirements:** AUTH-04, AUTH-05, GDPR-02

- [ ] Phase 14: Friends via Invite Link
  **Goal:** Replace "who is online" global view with opt-in friends graph. Solo players can invite friends via share link. Friends see each other's online status, sprint scores, and tier progress. Alias support (CRUD).
  **Requirements:** SOC-01, SOC-02

- [ ] Phase 15: multiplications 11-20 x 1-10
  **Goal:** multiplications 11-20 x 1-10
  **Requirements:** TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–8. v1.0 phases | v1.0 | 31/31 | Complete | 2026-03-15 |
| 9. Fixed Grid Visualization | v1.1 | 1/1 | Complete | 2026-03-16 |
| 10. Extended Tables Opt-In | v1.1 | 1/1 | Complete | 2026-03-17 |
| 11. Remove Global Leaderboard UI | 2/2 | Complete   | 2026-03-30 | — |
| 12. Database cleanup | v1.2 | 0/? | Pending | — |
| 13. Class-Scoped Username Uniqueness | v1.2 | 0/? | Pending | — |
| 14. Friends via Invite Link | v1.2 | 0/? | Pending | — |
| 15. multiplications 11-20 x 1-10 | v1.2 | 0/? | Pending | — |

## Backlog

### Phase 999.1: DKT Dashboard and Reset (BACKLOG)

**Goal:** Offer the raw DKT diagnostic stats to the user natively in the app, giving them insights into their proficiency data and providing a mechanism to selectively delete or reset their stats (e.g., if a sibling played on their device or they want a clean slate).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)
