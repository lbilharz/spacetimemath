---
phase: quick-260317-9uc
plan: 01
subsystem: ui
tags: [react, i18n, progress-page, tier-picker]

# Dependency graph
requires: []
provides:
  - Unified My Level card in ProgressPage replacing two separate tier cards
  - myLevel i18n key in en and de locales
affects: [ProgressPage, tier-status UX]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline edit affordance: header row onClick enters edit mode; pencil button as secondary affordance with stopPropagation"

key-files:
  created: []
  modified:
    - client/src/pages/ProgressPage.tsx
    - client/src/locales/en/translation.json
    - client/src/locales/de/translation.json

key-decisions:
  - "h2 heading removed from card — tier name + emoji row serves as visual anchor, no separate title needed"
  - "Pencil button uses stopPropagation to prevent double-fire with row onClick handler"
  - "Header row cursor:pointer only when !adjusting — avoids confusing click affordance during edit mode"

patterns-established:
  - "Unified summary+edit card: always-visible summary in header, inline edit controls appear below on interaction"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-17
---

# Quick Task 260317-9uc: Rename Adjust Level to My Level — Merge Cards Summary

**Single unified My Level card replaces two stacked tier cards on ProgressPage, with inline pencil-icon edit affordance replacing standalone full-width button**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-17T07:07:00Z
- **Completed:** 2026-03-17T07:09:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Removed redundant `#tier-status` summary card; its content (emoji, tier name, +N badge, Level pill, next-unlock hint) is now the header of the single `#my-level` card
- Replaced the standalone "✏️ Adjust Level" full-width button with a compact pencil icon (`✏️`) in the card header right-side; clicking anywhere on the header row also enters edit mode
- Added `tierPicker.myLevel` translation key to both `en` ("My Level") and `de` ("Mein Niveau") locale files

## Task Commits

1. **Task 1: Add myLevel translation key to both locales** - `6683720` (feat)
2. **Task 2: Merge tier-status card into unified My Level card** - `09f2639` (feat)

## Files Created/Modified

- `client/src/pages/ProgressPage.tsx` - Replaced two cards with single `#my-level` card; header row is tappable to enter edit mode; pencil button as secondary affordance
- `client/src/locales/en/translation.json` - Added `tierPicker.myLevel: "My Level"`
- `client/src/locales/de/translation.json` - Added `tierPicker.myLevel: "Mein Niveau"`

## Decisions Made

- `adjustTitle`, `adjustBody`, and `setLevel` keys kept — still used in edit-mode body text and save button label
- The `h2` heading ("Adjust Level") is intentionally removed from the card — the tier emoji + tier name row is the visual anchor; no separate title needed
- Header row `onClick` only fires `setAdjusting(true)` when `!adjusting` to prevent re-entry during active edit; pencil button uses `e.stopPropagation()` to avoid double-fire

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Progress page now has one card at top showing tier summary; tapping anywhere on the header or the pencil opens edit inline
- Extended-mode toggle remains functional at bottom of card when `isMaxTier`
- `npm run build` exits 0, all 44 unit tests pass

---
*Phase: quick-260317-9uc*
*Completed: 2026-03-17*
