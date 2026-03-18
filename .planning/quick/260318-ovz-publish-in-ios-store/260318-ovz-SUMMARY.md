---
phase: quick-260318-ovz
plan: "01"
subsystem: ios
tags: [ios, app-store, bundle-id, xcode]
dependency_graph:
  requires: []
  provides: [ios-store-ready-metadata]
  affects: [client/ios]
tech_stack:
  added: []
  patterns: [capacitor-ios-sync]
key_files:
  created: []
  modified:
    - client/ios/App/App/Info.plist
    - client/ios/App/App.xcodeproj/project.pbxproj
decisions:
  - "Bundle ID set to com.bettermarks.oneup to match capacitor.config.ts appId"
  - "Display name set to 1UP per branding guidelines"
metrics:
  duration: "~5 minutes (Task 1 only; Tasks 2-3 are human-action checkpoints)"
  completed_date: "2026-03-18"
---

# Quick Task 260318-ovz: Publish in iOS Store Summary

**One-liner:** Fixed bundle ID (com.bilharz.mathsprint -> com.bettermarks.oneup) and display name (Math Sprint -> 1UP), synced web assets; awaiting Xcode archive and App Store Connect submission by human.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Fix iOS project metadata (bundle ID, display name, version) | 6835c41 | Done |
| 2 | Archive in Xcode and upload to App Store Connect | — | Awaiting human action |
| 3 | Complete App Store Connect listing and submit for review | — | Awaiting human action |

## What Was Done (Task 1)

**Info.plist**
- Changed `CFBundleDisplayName` from `Math Sprint` to `1UP`

**project.pbxproj**
- Updated `PRODUCT_BUNDLE_IDENTIFIER` in both Debug and Release build configurations from `com.bilharz.mathsprint` to `com.bettermarks.oneup`
- `MARKETING_VERSION` (1.0) and `CURRENT_PROJECT_VERSION` (1) were already correct — left unchanged
- `DEVELOPMENT_TEAM` (B5J862SADT) left unchanged

**Build & Sync**
- `npm run build` — succeeded, 397 modules transformed
- `npx cap sync ios` — succeeded, web assets copied to ios/App/App/public

## Verification

```
grep -n "com.bettermarks.oneup" client/ios/App/App.xcodeproj/project.pbxproj | wc -l
# Result: 2 (both Debug and Release)

grep -A1 "CFBundleDisplayName" client/ios/App/App/Info.plist
# Result: <string>1UP</string>
```

## Deviations from Plan

None — plan executed exactly as written.

## Pending Human Actions

**Task 2:** Open Xcode, archive the app (Product → Archive), distribute via App Store Connect upload.

**Task 3:** Complete App Store Connect listing (screenshots, description, privacy policy, build selection) and submit for review.

See the PLAN.md for step-by-step instructions for both tasks.

## Self-Check: PASSED

- client/ios/App/App/Info.plist: FOUND, CFBundleDisplayName = 1UP
- client/ios/App/App.xcodeproj/project.pbxproj: FOUND, com.bettermarks.oneup in 2 places
- Commit 6835c41: verified in git log
