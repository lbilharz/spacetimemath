---
phase: quick
plan: 260316-ily
subsystem: ui
tags: [react, progresspage, toggle, pill-switch, extended-mode]

requires: []
provides:
  - "Pill-switch Extended Tables toggle in Adjust Level card with ×11 ×12 ×15 ×20 ×25 badges"
affects: [ProgressPage]

tech-stack:
  added: []
  patterns: ["Pill-switch checkbox using hidden <input type=checkbox> with absolutely-positioned track/thumb spans"]

key-files:
  created: []
  modified:
    - client/src/pages/ProgressPage.tsx

key-decisions:
  - "Toggle placed after the adjusting ternary block, still inside the .card.col.gap-12 div, so it is always visible when isMaxTier regardless of adjusting state"

patterns-established:
  - "Pill switch: hidden checkbox input + sibling track span + sibling thumb span with left transition; wrapping label covers whole switch area"

requirements-completed: []

duration: 5min
completed: 2026-03-16
---

# Quick Task 260316-ily: Extended Mode Toggle in Adjust Level Card

**Pill-switch Extended Tables toggle relocated from mastery card to bottom of Adjust Level card, with inline ×11 ×12 ×15 ×20 ×25 number badges and CSS-only track/thumb animation.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-16T13:25:00Z
- **Completed:** 2026-03-16T13:26:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Removed button-style toggle from mastery card (`#mastery`) — no more `{isMaxTier && <div className="row-between mb-4">...}` block
- Added pill-shaped checkbox switch at the bottom of the Adjust Level card, gated on `isMaxTier`
- Five inline number badges (×11 ×12 ×15 ×20 ×25) render next to the label using `.map()`
- Toggle wired to `handleToggleExtended` via `onChange`, thumb position and track colour driven by `extendedMode` prop
- `extendedSaving` disables the input and applies opacity + `not-allowed` cursor during save

## Task Commits

1. **Task 1: Move Extended Tables toggle to Adjust Level card as pill switch** - `e6e440b` (feat)

## Files Created/Modified
- `client/src/pages/ProgressPage.tsx` - Removed old button toggle from mastery card; added pill switch with number badges inside Adjust Level card

## Decisions Made
- Toggle placed after the adjusting ternary (not inside either branch) so it remains visible whether the tier ladder is in view-only or edit mode — both states share the same outer `.card.col.gap-12` container.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ProgressPage toggle UX improvement complete; no follow-on work required
- Extended mode state management and reducer call unchanged

---
*Phase: quick*
*Completed: 2026-03-16*
