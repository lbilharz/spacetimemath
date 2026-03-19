---
phase: quick
plan: 260319-p1b
subsystem: sprint-gameplay
tags: [sprint, ux, retry, pedagogy]
dependency_graph:
  requires: []
  provides: [retry-on-wrong-sprint-behavior]
  affects: [SprintPage, scoring]
tech_stack:
  added: []
  patterns: [early-return-guard, ref-reset-on-retry]
key_files:
  created: []
  modified:
    - client/src/pages/SprintPage.tsx
    - client/src/locales/en/translation.json
    - client/src/locales/de/translation.json
decisions:
  - "Move wrong-answer check BEFORE the token gate to prevent wrong answers being queued for server submission via pendingAnswerRef"
  - "800ms retry feedback delay (not 1000ms) — snappy but readable"
  - "Reset problemStartRef.current on retry so next correct answer's responseMs is measured from the retry attempt, not the original"
metrics:
  duration: "4 minutes"
  completed: "2026-03-19"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 3
---

# Quick Task 260319-p1b Summary

## One-liner

Retry-on-wrong sprint: wrong answers show "Try again!" + Rechenweg hint and re-present the same problem — no server submission, no time penalty, no score impact.

## What Was Done

Modified `doSubmit` in SprintPage.tsx so wrong answers never reach the server. When a student answers incorrectly:

1. `hapticBad()` fires (tactile feedback)
2. Feedback state is set to `isCorrect: false` — displays "Try again!" / "Nochmal!" + the Rechenweg hint (teaching without revealing the answer)
3. Function returns early — `submitAnswer`, `nextProblem`, `setAnswered`, `setCorrect`, `setScore`, and `setTimeLeft` are never called
4. After 800ms, feedback clears, input clears, `problemStartRef` resets — same problem re-appears fresh
5. If the student then answers correctly, the full submission flow fires normally

Correct answers continue to work exactly as before: token lookup, `submitAnswer`, counter increments, `nextProblem` prefetch, 600ms feedback, then advance.

Added `sprint.feedbackTryAgain` i18n key to both en and de locale files.

## Deviation: Token-gate reordering

**[Rule 1 - Bug] Moved wrong-answer check before the pendingAnswerRef token gate**

- **Found during:** Task 1 implementation review
- **Issue:** The original guard `if (!tokenRow) { pendingAnswerRef.current = ...; return; }` ran before the wrong-answer check. A wrong answer submitted when the token wasn't yet available would queue a pending retry via `pendingAnswerRef`, which the SEC-10 retry `useEffect` would then fire as `submitAnswer` — submitting the wrong answer to the server.
- **Fix:** Moved the `!isCorrect` early-return block above the tokenRow lookup. Wrong answers never touch the token system.
- **Files modified:** `client/src/pages/SprintPage.tsx`
- **Commit:** 870f311

## Self-Check: PASSED

- `client/src/pages/SprintPage.tsx` — modified, committed in 870f311
- `client/src/locales/en/translation.json` — modified, committed in 870f311
- `client/src/locales/de/translation.json` — modified, committed in 870f311
- TypeScript: `npx tsc --noEmit` — 0 errors
- Tests: 44 passed (3 test files)
