# Changelog

All notable changes to Better 1UP are documented here.

## [1.7.0] — 2026-04-28

### Added
- **Multi-account switcher** — parents can manage multiple child profiles on a single device. Switch between accounts in one tap from the Account page; add new profiles via "+ Add Player"; logout gracefully falls back to the next available account.

### Fixed
- **Extended mode problems leaking into standard sprints** — players who had not opted into extended mode (×11–×20) were receiving those problems. Root cause: `build_sequence` silently discarded the `extended_mode` / `extended_level` parameters. Added explicit guards in the sequence builder and in both SEC-06 server-side validation points (`issue_problem`, `submit_answer`).
- **20×20 mastery grid not rendering in extended mode** — the grid was capped at 10 columns regardless of whether extended mode was active. Now correctly renders up to 20×20 for extended players.
- **Mastery grid horizontal overflow** — grid is now properly centered on small screens (`w-full` + `width: max-content` + `mx-auto`) without clipping.
- **Space-metaphor copy** — replaced Gemini-introduced astronomical flavour text with plain, brand-consistent language across the lobby and onboarding UI.

### Internal
- Android adaptive icon updated with 16.7% inset so the logo sits within the safe-zone on all launcher shapes.
- iOS/Android build numbers bumped to 24.
- `sharp` pinned to 0.33.4 via pnpm override to prevent build errors.
- `.gitignore` extended: `client/android/.idea/`, `client/ios/App/.bundle/`, `client/ios/App/vendor/`.
- Added official testing guide (`Better_1UP_Testing_Guide.md`) and audio generation scripts (`elevenlabs_gen.ts`, `generateGreetings.ts`).

---

## [1.6.0] — 2026-03-xx

### Added
- Extended tier system: 17 tiers total (0–16), unlocking ×11–×20 multiplication tables progressively.
- DKT-gated tier progression: tier advancement now requires server-side DKT evidence, not just client-side accuracy.
- KC mastery updates both Fact-Ns for every pair (e.g. 3×7 updates both Fact3s and Fact7s).

### Fixed
- Teacher upgrade form: email prompt no longer re-appears after verification.
- Live observer: teacher can now inspect a student's active problem in real time.
- Security: answer submissions validated against pre-generated `sprint_sequences` tokens.

---

## [1.5.0] — 2026-02-xx

### Added
- Push notification reminders (native app, iOS & Android).
- Reminders section on web links to App Store / Google Play.
- Android edge-to-edge display.
- Tier accuracy rendered from server DKT mastery rather than client-recomputed buckets.

### Fixed
- Recovery URL race condition causing premature lobby redirect.
- iOS WKWebView CORS issues via CapacitorHttp.
- Tier label translations for tiers 8–16.

---

## [1.3.0] — 2026-01-xx

### Added
- Inline join forms on Lobby, Classrooms, and Friends pages.
- Party overlay celebrations on tier unlock.
- Friend deep-link auto-join.
- 404 page with animated broken SplashGrid.
- Full i18n pass: ~280 keys across 8 languages.

### Fixed
- Single-step gamertag registration flow (removed multi-step onboarding).
- SPA direct-URL 404 on Vercel.
- iOS auto-zoom on input focus.

---

## [1.2.0] — 2025-12-xx

### Added
- Auto-fill join code on registration.
- Email magic-link account recovery.
- Progress page: unified mission briefing + fog-of-war mastery grid.
- Multilingual lobby greeting (8 languages).

### Fixed
- Capacitor iOS CORS preflight handling.
- App Store Universal Links (AASA format update).
- SpaceTimeDB SDK pinned to 2.0.3 for stability.
