---
phase: 11-remove-global-leaderboard-ui
plan: "02"
subsystem: i18n
tags: [i18n, leaderboard-removal, locale-cleanup, coppa-dsgvo]
dependency_graph:
  requires: ["11-01"]
  provides: ["clean i18n — no global leaderboard keys in any locale"]
  affects: ["client/src/locales/*/translation.json"]
tech_stack:
  added: []
  patterns: ["i18next flat-key namespace removal"]
key_files:
  created: []
  modified:
    - client/src/locales/en/translation.json
    - client/src/locales/de/translation.json
    - client/src/locales/fr/translation.json
    - client/src/locales/nl/translation.json
    - client/src/locales/tr/translation.json
    - client/src/locales/uk/translation.json
    - client/src/locales/ar/translation.json
    - client/src/locales/zh/translation.json
    - client/src/locales/es/translation.json
decisions:
  - "Removed top-level leaderboard namespace (10 keys) from all 9 locale files"
  - "Removed results.rank key from all 9 locale files"
  - "Updated register.tagline to language-idiomatic 'beat your best' phrasing per language"
  - "Preserved classroom.leaderboard, classSprint.review.leaderboard, classSprint.rankingTitle (class-scoped)"
metrics:
  duration: "15 minutes"
  completed_date: "2026-03-30"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 9
requirements: [APP-01]
---

# Phase 11 Plan 02: i18n Cleanup — Remove Global Leaderboard Keys Summary

**One-liner:** Removed 10-key global `leaderboard` namespace and `results.rank` from all 9 locale files; updated `register.tagline` to language-idiomatic "beat your best" phrasing eliminating all leaderboard references from translation strings.

## What Was Done

Cleaned all 9 locale files (`en`, `de`, `fr`, `nl`, `tr`, `uk`, `ar`, `zh`, `es`) as three coordinated changes:

**Change A — Removed `"leaderboard"` top-level namespace:** The entire object (10 keys: `title`, `empty`, `colHash`, `colPlayer`, `colScore`, `colAccuracy`, `colAnswers`, `you`, `footer`, `tierAll`) deleted from all 9 files. This namespace served the deleted `Leaderboard.tsx` component.

**Change B — Removed `results.rank` key:** Removed from all 9 files. This key served the global rank `<Stat>` removed in plan 11-01.

**Change C — Updated `register.tagline`:** Replaced "Live leaderboard." phrase with language-idiomatic alternatives:
- en: "Beat your best."
- de: "Schlag deinen Rekord."
- fr: "Bats ton record."
- nl: "Versla je record."
- tr: "Rekorunu kir."
- uk: "Побий свій рекорд."
- ar: "حطّم رقمك القياسي."
- zh: "打破你的纪录。"
- es: "Supera tu mejor marca."

## Verification Results

| Check | Result |
|-------|--------|
| `npm run lint:i18n` | PASSED — all 8 non-English locales fully translated |
| `npm run build` | PASSED — built in 2.63s |
| No `"leaderboard": {` namespace object | PASSED — 0 matches |
| No `"rank"` key in `results` namespace | PASSED — 0 matches |
| `register.tagline` in en | "60 seconds. Multiplication tables. Beat your best." |
| `classroom.leaderboard` preserved | PASSED |
| `classSprint.review.leaderboard` preserved | PASSED |
| `classSprint.rankingTitle` preserved | PASSED |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 303bd4e8 | feat(11-02): remove global leaderboard i18n keys and update register tagline |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- All 9 locale files exist and were modified
- Commit 303bd4e8 exists in git log
- lint:i18n passes with 348 keys across all locales
- build passes without errors
