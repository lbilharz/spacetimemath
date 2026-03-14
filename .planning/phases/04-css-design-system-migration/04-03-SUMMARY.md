---
phase: 04-css-design-system-migration
plan: "03"
subsystem: ui
tags: [css, design-system, utility-classes, pages, migration]

# Dependency graph
requires:
  - "04-01: utility class layer in index.css (~60 classes)"
  - "04-02: component migration patterns established"
provides:
  - "8 page files migrated from inline styles to utility classes"
  - ".btn-link utility class for ghost text-underline button pattern"
  - ".code-box utility class for monospace code display boxes"
affects:
  - "04-04: ClassroomPage migration (only remaining page)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ghost link buttons: .btn-link replaces repeated background:none/border:none/cursor:pointer/text-decoration:underline pattern"
    - "Code display: .code-box provides base monospace accent styling; per-instance font-size/letterSpacing remain inline"
    - "Table migration: delete local const th/td objects, use .table-full + .tbl-th + .tbl-td + alignment variants"
    - "Dynamic styles stay as style={}: timerColor (computed from timeLeft), timerPct (computed percentage), feedback border (conditional), numpad colors (conditional key type)"

key-files:
  created: []
  modified:
    - client/src/pages/ProgressPage.tsx
    - client/src/pages/RegisterPage.tsx
    - client/src/pages/ClassroomsPage.tsx
    - client/src/pages/LobbyPage.tsx
    - client/src/pages/SprintPage.tsx
    - client/src/pages/ResultsPage.tsx
    - client/src/pages/ClassSprintResultsPage.tsx
    - client/src/pages/AccountPage.tsx
    - client/src/index.css

key-decisions:
  - "Ghost link button pattern (.btn-link) added to index.css — appears in RegisterPage (2x) and also App.tsx, SprintHistory, ScoringGuide, ClassroomPage across codebase"
  - ".code-box utility captures shared monospace/accent/card2 border styling; per-instance overrides (fontSize, letterSpacing, padding) kept inline since transfer code and recovery key have different visual sizes"
  - "liveTd constant in LobbyPage deleted; live players table now uses .tbl-td with inline padding overrides (9px 4px, 14px) since live feed uses different density than the tbl-td defaults (8px 4px, 13px)"
  - "ResultsPage score fontSize (72px) is static in actual code — not computed from score length as research notes suggested; stays as inline one-off value"
  - "Remaining style={} props all justified: unique one-off values (fontSize 28/36/44/etc.), no-utility-equivalent properties (justifyContent:center, minHeight, maxWidth, letterSpacing, flexWrap, textDecoration, textTransform), or genuinely dynamic/conditional styles"

patterns-established:
  - "Apply .row-between + style={{ flexWrap: 'wrap' }} when flex-wrap needed on a row-between layout"
  - "Combine .card with layout utilities: className='card row-between gap-12' replaces card + display:flex + align-items:center + justify-content:space-between + gap"

requirements-completed: [CSS-03]

# Metrics
duration: 11min
completed: 2026-03-15
---

# Phase 4 Plan 03: CSS Page Migration Summary

**8 page files migrated from inline styles to utility classes — timerColor, timerPct, and all conditional/dynamic styles preserved as style={}**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-14T23:37:35Z
- **Completed:** 2026-03-14T23:48:35Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- All 8 page files migrated: ProgressPage, RegisterPage, ClassroomsPage, LobbyPage, SprintPage, ResultsPage, ClassSprintResultsPage, AccountPage
- Added .btn-link utility class (ghost text-underline button reset pattern used 2x in RegisterPage, appears in 5+ files across codebase)
- Added .code-box utility class (monospace accent code display used for transfer code + recovery key in AccountPage)
- SprintPage: timerColor and timerPct remain as style={} as required; all static layout/typography converted
- ResultsPage: score display (static fontSize 72) and all static patterns converted; complex bordered hint expansions kept inline
- ClassSprintResultsPage: deleted local `const th`/`const td` objects; migrated to .table-full + .tbl-th + .tbl-td
- All 37 tests pass after both tasks

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate ProgressPage, RegisterPage, ClassroomsPage, LobbyPage** - `43e5e4c` (feat)
2. **Task 2: Migrate SprintPage, ResultsPage, ClassSprintResultsPage, AccountPage** - `286bb47` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `client/src/pages/ProgressPage.tsx` - Tier-status card layout, typography, spacing converted to utility classes
- `client/src/pages/RegisterPage.tsx` - Form layout, error text, ghost link buttons converted; .btn-link class used
- `client/src/pages/ClassroomsPage.tsx` - Classroom list, action buttons, create/join forms converted
- `client/src/pages/LobbyPage.tsx` - Recovery nag, sprint CTA row, live players table converted; liveTd const deleted
- `client/src/pages/SprintPage.tsx` - Loading states, timer bar, problem card layout, feedback text converted; runtime styles preserved
- `client/src/pages/ResultsPage.tsx` - Score card, mastery section, unlock toast, back button converted
- `client/src/pages/ClassSprintResultsPage.tsx` - const th/const td deleted; ranking table migrated to .tbl-th/.tbl-td
- `client/src/pages/AccountPage.tsx` - Profile header, all cards, code displays, forms, danger zone converted; .code-box class used
- `client/src/index.css` - Added .btn-link and .code-box utility classes

## Decisions Made
- Ghost link button (.btn-link) added because the background:none/border:none reset pattern repeats across pages
- .code-box base class added; fontSize/letterSpacing/padding kept inline since transfer code and recovery key have different visual densities
- liveTd (9px/14px) differs from .tbl-td (8px/13px); kept inline padding overrides rather than a separate tbl-td--live variant
- justifyContent:center, minHeight, maxWidth, flexWrap, textDecoration, textTransform have no utility equivalents — kept inline as genuinely irreducible values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 8 target pages migrated; only ClassroomPage remains (handled in Plan 04 due to its size)
- .btn-link and .code-box utility classes available for ClassroomPage migration
- No blockers

## Self-Check: PASSED

- `client/src/pages/ProgressPage.tsx` — FOUND
- `client/src/pages/RegisterPage.tsx` — FOUND
- `client/src/pages/ClassroomsPage.tsx` — FOUND
- `client/src/pages/LobbyPage.tsx` — FOUND
- `client/src/pages/SprintPage.tsx` — FOUND
- `client/src/pages/ResultsPage.tsx` — FOUND
- `client/src/pages/ClassSprintResultsPage.tsx` — FOUND
- `client/src/pages/AccountPage.tsx` — FOUND
- `client/src/index.css` — FOUND
- Commit `43e5e4c` — FOUND
- Commit `286bb47` — FOUND

---
*Phase: 04-css-design-system-migration*
*Completed: 2026-03-15*
