---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: App Store Submission
status: unknown
stopped_at: "Completed 11-02-PLAN.md (Remove global leaderboard i18n keys — all 9 locale files cleaned, lint:i18n passing)"
last_updated: "2026-03-30T20:43:36.919Z"
last_activity: "2026-03-30 — Completed 11-01: Deleted Leaderboard.tsx, removed Live Players table from LobbyPage, removed global rank stat from ResultsPage, dropped best_scores/online_players subscriptions from App.tsx"
progress:
  total_phases: 11
  completed_phases: 11
  total_plans: 35
  completed_plans: 35
  percent: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17 after v1.1 milestone)

**Core value:** Students practice multiplication facts in a fair, safe, adaptive environment — and the score they see reflects genuine mastery.
**Current focus:** v1.2 — App Store Submission (Phase 11 in progress)

## Current Position

Phase 11 (remove-global-leaderboard-ui): Plan 01 complete.
Phase 11 Plan 01 (11-01) complete — global leaderboard UI removed, COPPA/DSGVO surfaces eliminated.

Last activity: 2026-03-30 — Completed 11-01: Deleted Leaderboard.tsx, removed Live Players table from LobbyPage, removed global rank stat from ResultsPage, dropped best_scores/online_players subscriptions from App.tsx

Progress: [█░░░░░░░░░] 5% (1/1 plans complete in v1.2)

## Decisions

- (11-01) Deleted Leaderboard.tsx entirely rather than hiding it to prevent accidental re-import
- (11-01) Dropped best_scores and online_players subscriptions at App.tsx root — client no longer fetches global player data at all
- (11-01) Kept sessions subscription in ResultsPage (still needed for session.isComplete and mastery grid)
- [Phase 11]: Removed 10-key global leaderboard i18n namespace from all 9 locale files to complete UI removal
- [Phase 11]: Updated register.tagline with language-idiomatic beat-your-best phrasing per locale
- [Roadmap]: Replaced Phase 12 (Onboarding weiche) with Database cleanup.

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260317-t6z | bugfix: teacher class recovery code PDF download broken | 2026-03-17 | 9e0e94a | [260317-t6z-bugfix-teacher-class-recovery-code-pdf-d](./quick/260317-t6z-bugfix-teacher-class-recovery-code-pdf-d/) |
| 260317-fto | bugfix: sprint start + scoring broken (auto_inc desync after restore) | 2026-03-17 | 77aea4c | [260317-fto-users-can-t-start-a-sprint-bug-fix](./quick/260317-fto-users-can-t-start-a-sprint-bug-fix/) |
| 260317-war | style login cards — branded PDF (navy header, 1UP logo, QR, clean layout) | 2026-03-18 | 5d557aa | [260317-war-style-login-cards](./quick/260317-war-style-login-cards/) |
| 260318-ovz | iOS App Store prep: fix bundle ID + display name, sync web assets (Tasks 2-3 await human) | 2026-03-18 | 6835c41 | [260318-ovz-publish-in-ios-store](./quick/260318-ovz-publish-in-ios-store/) |
| 260318-ss6 | change iOS bundle ID to net.bilharz.oneup in Xcode project (Debug + Release) | 2026-03-18 | cc2e555 | [260318-ss6-change-ios-bundle-id-to-net-bilharz-oneu](./quick/260318-ss6-change-ios-bundle-id-to-net-bilharz-oneu/) |
| 260318-v10 | center sprint screen content vertically between header and numpad on tall devices | 2026-03-18 | 8e7e710 | [260318-v10-center-sprint-screen-content-vertically-](./quick/260318-v10-center-sprint-screen-content-vertically-/) |
| 260319-21o | tune tier advancement: last-3 window, 60% pairs threshold, brilliant-sprint fast-track | 2026-03-19 | 9183c8f | [260319-21o-tune-tier-advancement-last-3-window-60-p](./quick/260319-21o-tune-tier-advancement-last-3-window-60-p/) |
| 260319-p1b | retry-on-wrong sprint behavior: wrong answers re-offer same problem, no server submission, no time penalty | 2026-03-19 | 870f311 | [260319-p1b-in-spacetimemath-app-sprints-should-re-o](./quick/260319-p1b-in-spacetimemath-app-sprints-should-re-o/) |
| 260321-c6m | WebSocket reconnection stability: no splash on reconnect, sprint state preserved, no repeated questions | 2026-03-21 | 4e07962 | [260321-c6m-fix-websocket-reconnection-stability-on-](./quick/260321-c6m-fix-websocket-reconnection-stability-on-/) |

## Session Continuity

Last session: 2026-03-30T20:43:36.916Z
Stopped at: Completed 11-02-PLAN.md (Remove global leaderboard i18n keys — all 9 locale files cleaned, lint:i18n passing)
Resume file: None
