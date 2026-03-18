---
phase: quick-260318-ss6
plan: 01
subsystem: ios
tags: [ios, bundle-id, app-store]
dependency_graph:
  requires: []
  provides: [net.bilharz.oneup bundle identifier in Xcode project]
  affects: [App Store Connect submission]
tech_stack:
  added: []
  patterns: []
key_files:
  modified:
    - client/ios/App/App.xcodeproj/project.pbxproj
decisions:
  - Used replace_all Edit to update both Debug and Release configurations atomically
metrics:
  duration: ~2 minutes
  completed: 2026-03-18T19:45:17Z
  tasks_completed: 1
  files_modified: 1
---

# Phase quick-260318-ss6 Plan 01: Change iOS Bundle ID to net.bilharz.oneup Summary

**One-liner:** Replaced com.bettermarks.oneup with net.bilharz.oneup in both Debug and Release XCBuildConfiguration blocks in project.pbxproj.

## What Was Done

Updated `client/ios/App/App.xcodeproj/project.pbxproj` to use the correct App Store Connect bundle identifier `net.bilharz.oneup` for the 1UP app under the bilharz developer account.

## Tasks

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Update PRODUCT_BUNDLE_IDENTIFIER in project.pbxproj | cc2e555 | Done |

## Verification

```
grep -c "net.bilharz.oneup" project.pbxproj   # returns 2
grep "com.bettermarks.oneup" project.pbxproj  # returns nothing
```

Both checks passed.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- File modified: client/ios/App/App.xcodeproj/project.pbxproj — FOUND
- Commit cc2e555 — FOUND
- 2 occurrences of net.bilharz.oneup, 0 occurrences of com.bettermarks.oneup — VERIFIED
