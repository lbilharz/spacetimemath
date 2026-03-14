# Requirements: 1UP — Math Sprint

**Defined:** 2026-03-14
**Core Value:** Students practice multiplication facts in a fair, safe, adaptive environment — and the score they see reflects genuine mastery.

## v1 Requirements

Requirements for the safe-for-public-launch milestone. All map to roadmap phases.

### Security

- [x] **SEC-01**: `recovery_keys` table is private — not readable by other clients
- [x] **SEC-02**: `transfer_codes` table is private — not readable by other clients
- [x] **SEC-03**: AccountPage retrieves recovery/transfer codes via reducer call, not table subscription
- [x] **SEC-04**: `submit_answer` rejects submissions exceeding a per-session answer cap
- [x] **SEC-05**: `submit_answer` rejects `response_ms` below 200ms (bot/replay prevention)
- [x] **SEC-06**: `submit_answer` validates `(a, b)` pair is within the player's unlocked tier
- [x] **SEC-07**: `use_transfer_code` verifies the calling identity owns the code being consumed
- [x] **SEC-08**: `register` and `set_username` reject usernames containing null bytes, control characters, or Unicode homoglyphs
- [x] **SEC-09**: Transfer codes expire automatically via scheduled reducer (TTL-based cleanup)
- [x] **SEC-10**: Server-issued problem token closes remaining score-injection vectors

### GDPR Compliance

- [x] **GDPR-01**: `delete_player` reducer exists with full cascade (removes player, sessions, answers, stat contributions)

### Scoring & Tier System

- [x] **SCORE-01**: Class sprint sessions are credited to the overall leaderboard (BestScore upsert runs on class sprint finalization)
- [x] **SCORE-02**: Class sprint sessions trigger tier unlock check (same logic as solo sprints)
- [x] **SCORE-03**: Tier structure redesigned to multiplier-column model:
  - Tier 1 (starter): all pairs where one factor ∈ {1, 2, 10}
  - Tier 2: adds ×3
  - Tier 3: adds ×5
  - Tier 4: adds ×4
  - Tier 5: adds ×6
  - Tier 6: adds ×7
  - Tier 7: adds ×8
  - Tier 8: adds ×9 (all 1–10 × 1–10 complete)

### CSS Design System

- [ ] **CSS-01**: `index.css` extended with utility classes covering all recurring inline style patterns (text color, font size, spacing, flex layout)
- [ ] **CSS-02**: All inline `style={}` props in `client/src/components/` replaced with CSS classes
- [ ] **CSS-03**: All inline `style={}` props in `client/src/pages/` replaced with CSS classes
- [ ] **CSS-04**: All pages use consistent layout, spacing, typography, and color — no visual outliers

### UX & Bug Fixes

- [ ] **UX-01**: Account page no longer shows classroom list
- [ ] **UX-02**: ClassroomPage hides the join/login code from student role (visible to teacher only)
- [ ] **UX-03**: ClassroomPage renders correctly on mobile (no layout breakage)
- [ ] **UX-04**: Redundant "view class results" variant removed from ClassroomPage
- [ ] **UX-05**: Recovery code is not regenerated on routine navigation or reconnection

## v2 Requirements

Deferred to a future milestone. Tracked but not in current roadmap.

### Legal Documents

- **LEGAL-01**: German Datenschutzerklärung (privacy policy, GDPR Art. 13)
- **LEGAL-02**: Impressum page (German legal requirement)
- **LEGAL-03**: DPA template document for schools
- **LEGAL-04**: Plain-language data notice on RegisterPage

### Account Management

- **ACCT-01**: Self-service account deletion UI in AccountPage
- **ACCT-02**: Data transparency page (what is stored, how to delete)

### Advanced Security

- **SEC-11**: Replace `subscribeToAllTables()` with targeted table subscriptions
- **SEC-12**: Difficulty weight poisoning prevention (rate-limit ProblemStat updates)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Arithmetic expansion (addition, subtraction, etc.) | Next milestone after safe launch |
| New game mechanics | Scope freeze until launch-ready |
| App Store / Play Store release | Web-first launch first |
| COPPA compliance | US-only regulation; not applicable |
| Tailwind / CSS Modules | No new build dependencies needed; plain CSS classes sufficient |
| OAuth or email-based login | SpacetimeDB Identity sufficient; adding email increases PII surface |
| Difficulty weight tuning (community stats) | Tier restructure addresses root cause; community stats still useful post-launch |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| SEC-04 | Phase 1 | Complete |
| SEC-05 | Phase 1 | Complete |
| SEC-06 | Phase 1 | Complete |
| SEC-07 | Phase 1 | Complete |
| SEC-08 | Phase 1 | Complete |
| SEC-09 | Phase 1 | Complete |
| SEC-10 | Phase 1 | Complete |
| GDPR-01 | Phase 2 | Complete |
| SCORE-01 | Phase 2 | Complete |
| SCORE-02 | Phase 2 | Complete |
| SCORE-03 | Phase 2 | Complete |
| CSS-01 | Phase 4 | Pending |
| CSS-02 | Phase 4 | Pending |
| CSS-03 | Phase 4 | Pending |
| CSS-04 | Phase 4 | Pending |
| UX-01 | Phase 3 | Pending |
| UX-02 | Phase 3 | Pending |
| UX-03 | Phase 3 | Pending |
| UX-04 | Phase 3 | Pending |
| UX-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23 (complete)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after roadmap creation*
