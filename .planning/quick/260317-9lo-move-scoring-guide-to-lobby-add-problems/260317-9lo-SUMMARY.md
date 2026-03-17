---
phase: quick
plan: 260317-9lo
subsystem: client-ui
tags: [ux, lobby, results, scoring-guide, sprint-results]
dependency_graph:
  requires: []
  provides: [scoring-guide-in-lobby, problems-grid-in-results]
  affects: [LobbyPage, ProgressPage, ResultsPage]
tech_stack:
  added: []
  patterns: [useTable subscription, i18n translation keys]
key_files:
  created: []
  modified:
    - client/src/pages/LobbyPage.tsx
    - client/src/pages/ProgressPage.tsx
    - client/src/pages/ResultsPage.tsx
    - client/src/locales/en/translation.json
    - client/src/locales/de/translation.json
decisions:
  - ScoringGuide moved to LobbyPage with its own problem_stats useTable subscription — LobbyPage did not previously subscribe to problem_stats
  - problems grid uses local Answer type extended with userAnswer field (was missing from ResultsPage's type definition)
  - i18n key results.problemsTitle added to both en and de locales
metrics:
  duration: ~5 min
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_modified: 5
---

# Phase quick Plan 260317-9lo: Move ScoringGuide to Lobby + Add Problems Grid Summary

**One-liner:** ScoringGuide moved from ProgressPage to LobbyPage (below leaderboard), and a color-coded problems-answered grid added to ResultsPage below the mastery grid.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Move ScoringGuide to LobbyPage | 6f027e0 | LobbyPage.tsx, ProgressPage.tsx |
| 2 | Add problems-solved grid to ResultsPage | a46997c | ResultsPage.tsx, en/translation.json, de/translation.json |

## Checkpoint

**Task 3 (checkpoint:human-verify):** Awaiting visual verification.

Verify:
1. Run `cd /Users/lbi/Projects/spacetimemath/client && npm run dev`
2. Navigate to Lobby page — scroll below leaderboard and confirm ScoringGuide appears.
3. Navigate to Progress page — confirm ScoringGuide is gone (Sprint History should still be there).
4. Complete a sprint — confirm "Problems this sprint" card appears below the mastery grid showing all problems with color coding (wrong = red, correct = green).

## Deviations from Plan

**1. [Rule 1 - Bug] Added userAnswer to local Answer type in ResultsPage**
- **Found during:** Task 2
- **Issue:** ResultsPage had a local `Answer` type that was missing the `userAnswer` field, which the plan's JSX referenced.
- **Fix:** Added `userAnswer: number` to the local Answer type definition.
- **Files modified:** client/src/pages/ResultsPage.tsx
- **Commit:** a46997c (included in task commit)

## Self-Check: PASSED

Files created/modified:
- FOUND: client/src/pages/LobbyPage.tsx
- FOUND: client/src/pages/ProgressPage.tsx
- FOUND: client/src/pages/ResultsPage.tsx
- FOUND: client/src/locales/en/translation.json
- FOUND: client/src/locales/de/translation.json

Commits:
- FOUND: 6f027e0 (move ScoringGuide from ProgressPage to LobbyPage)
- FOUND: a46997c (add problems-solved grid to ResultsPage)
