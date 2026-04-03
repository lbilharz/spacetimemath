---
phase: 11-remove-global-leaderboard-ui
plan: "01"
subsystem: ui
tags: [react, typescript, spacetimedb, coppa, dsgvo, leaderboard, privacy]

# Dependency graph
requires: []
provides:
  - "LobbyPage without global leaderboard or live players table (COPPA/DSGVO clean)"
  - "ResultsPage with 2-column stat grid, no global rank"
  - "App.tsx without best_scores/online_players root subscriptions"
  - "Leaderboard.tsx deleted from codebase"
affects: [app-store-submission, privacy-review, ios-submission]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Remove subscription at root level to stop client from subscribing to privacy-sensitive global tables"

key-files:
  created: []
  modified:
    - "client/src/pages/LobbyPage.tsx"
    - "client/src/pages/ResultsPage.tsx"
    - "client/src/App.tsx"
  deleted:
    - "client/src/components/Leaderboard.tsx"

key-decisions:
  - "Deleted Leaderboard.tsx entirely rather than hiding it — prevents accidental re-import"
  - "Kept sessions subscription in ResultsPage (still needed for session.isComplete and mastery grid)"
  - "Kept TIER_EMOJI in LobbyPage (still used for tier status badge in welcome card)"
  - "Drop best_scores and online_players subscriptions at App.tsx root — client no longer fetches this data at all"

patterns-established:
  - "Privacy removal: delete file + remove import + remove subscription = complete surface elimination"

requirements-completed: [APP-01, APP-02]

# Metrics
duration: 15min
completed: 2026-03-30
---

# Phase 11 Plan 01: Remove Global Leaderboard UI Summary

**Deleted global leaderboard component and all privacy-exposing surfaces (live players table, global rank stat, best_scores/online_players subscriptions) to unblock COPPA/DSGVO App Store submission**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-30T00:00:00Z
- **Completed:** 2026-03-30T00:15:00Z
- **Tasks:** 2
- **Files modified:** 3 modified, 1 deleted

## Accomplishments

- Deleted `client/src/components/Leaderboard.tsx` — the global leaderboard component no longer exists in the codebase
- Removed the "Live Players" table from LobbyPage along with all associated subscriptions (best_scores, online_players, sessions) and computed values (sprintingIds, connectedAtMap, sortedBestScores, allOnline, liveList, selfEntry, others)
- Removed global rank stat from ResultsPage stat grid, changed layout from grid-cols-3 to grid-cols-2 (Correct + Max Streak remain)
- Dropped elevated `useTable(tables.best_scores)` and `useTable(tables.online_players)` root subscriptions from App.tsx — client no longer subscribes to these tables at all
- TypeScript build passes clean (exit 0), all 8 i18n locale checks pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove global leaderboard and live players from LobbyPage + delete Leaderboard component** - `0b57adee` (feat)
2. **Task 2: Remove global rank stat from ResultsPage and drop root subscriptions from App.tsx** - `d98e64b5` (feat)

**Plan metadata:** (docs commit pending)

## Files Created/Modified

- `client/src/pages/LobbyPage.tsx` — Removed best_scores/online_players/sessions subscriptions, all live-player computed values, Live Players JSX block, Leaderboard JSX block, and related type imports
- `client/src/pages/ResultsPage.tsx` — Removed completedSessions/sorted/myRank rank computation, Rank Stat JSX card, changed grid-cols-3 to grid-cols-2
- `client/src/App.tsx` — Dropped `useTable(tables.best_scores)` and `useTable(tables.online_players)` elevated subscriptions and their comment
- `client/src/components/Leaderboard.tsx` — DELETED

## Decisions Made

- Deleted Leaderboard.tsx entirely rather than hiding it — prevents accidental re-import and is unambiguous for code review
- Kept `sessions` subscription in ResultsPage — still required for `session.isComplete` check and the mastery grid display
- Kept `TIER_EMOJI` constant in LobbyPage — still used in the welcome card tier status badge
- Dropped subscriptions at the App.tsx root level to ensure the client never fetches global player data, not just that it's not displayed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Privacy surfaces eliminated; client no longer subscribes to best_scores or online_players tables
- App Store submission can proceed without COPPA/DSGVO leaderboard objections
- Class sprint leaderboard in ClassroomPage is untouched and remains functional

---
*Phase: 11-remove-global-leaderboard-ui*
*Completed: 2026-03-30*
