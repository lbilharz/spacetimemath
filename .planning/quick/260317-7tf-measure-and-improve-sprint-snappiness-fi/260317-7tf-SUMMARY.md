---
phase: quick-260317-7tf
plan: 01
subsystem: client/sprint-ui
tags: [performance, react, memoization]
dependency_graph:
  requires: []
  provides: [memoized-sprint-ui]
  affects: [SprintPage, DotArray]
tech_stack:
  added: []
  patterns: [React.memo, useMemo, useCallback, extracted-sub-component]
key_files:
  created: []
  modified:
    - client/src/pages/SprintPage.tsx
    - client/src/components/DotArray.tsx
decisions:
  - "SPRINT_DURATION and input added to doSubmit useCallback dep array to satisfy react-hooks/exhaustive-deps (SPRINT_DURATION is a local const derived from isDiagnostic already in array; input is state read directly)"
metrics:
  duration: 3 min
  completed: 2026-03-17
---

# Phase quick-260317-7tf Plan 01: Sprint Snappiness Optimization Summary

**One-liner:** React.memo Numpad sub-component + useMemo/useCallback memoization eliminates redundant re-renders on every 1-second timer tick in SprintPage.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Memoize derived values and stabilize doSubmit in SprintPage | aadd701, 3ed55c1 | SprintPage.tsx |
| 2 | Wrap DotArray in React.memo | ae6d835 | DotArray.tsx |

## Changes Made

### SprintPage.tsx

- Added `React` and `useMemo` to the import (was using named imports only)
- `myAnswers`: wrapped in `useMemo([allAnswers, myIdentityHex])` — was recomputed on every render
- `eligibleStats`: wrapped in `useMemo([problemStats, playerLearningTier])` — was recomputed on every render
- `currentStat`, `difficultyTag`, `mastery`: hoisted out of inline JSX IIFEs into `useMemo` above early returns — were recomputed on every render including every timer tick
- `doSubmit`: converted from `async () =>` to `useCallback(async () => ..., [deps])` — recreated on every render before; also fixed missing `input` and `SPRINT_DURATION` dependencies caught by lint
- `Numpad`: new `React.memo` component defined outside `SprintPage`, accepts `disabled: boolean` and `onKey` callback — the 12 numpad buttons no longer re-render on timer ticks
- `handleNumpadKey`: new `useCallback` wrapping numpad key dispatch, depends only on `doSubmit`

### DotArray.tsx

- Added `import React from 'react'` (required for `React.memo`)
- Changed from `export default function` to named `function`, added `export default React.memo(DotArray)` at the bottom
- No rendering logic, constants, or styles changed

## Verification

- All 44 tests pass after both tasks
- Zero TypeScript errors (`npx tsc --noEmit`)
- All lint warnings in modified files resolved (28 remaining are pre-existing in integration test files)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing dep] Added `input` and `SPRINT_DURATION` to doSubmit useCallback dep array**
- **Found during:** Task 1 — lint hook ran on pre-commit
- **Issue:** `react-hooks/exhaustive-deps` warned that `input` (state read in `parseInt(input)`) and `SPRINT_DURATION` (local const used in `setTimeout` callback) were missing from the dep array
- **Fix:** Added both to the array in a follow-up commit
- **Files modified:** client/src/pages/SprintPage.tsx
- **Commit:** 3ed55c1

## Self-Check

Files exist:
- client/src/pages/SprintPage.tsx — modified
- client/src/components/DotArray.tsx — modified

Commits exist:
- aadd701 — Task 1 initial
- 3ed55c1 — Task 1 dep array fix
- ae6d835 — Task 2 DotArray memo

## Self-Check: PASSED
