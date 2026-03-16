# Requirements: 1UP — Math Sprint

**Defined:** 2026-03-16
**Milestone:** v1.1 — Fixed Grid + Extended Tables
**Core Value:** Students practice multiplication facts in a fair, safe, adaptive environment — and the score they see reflects genuine mastery.

## v1.1 Requirements

### Visualization

- [ ] **VIZ-01**: Player sees a fixed-size 10×10 dot grid for every problem (same dimensions regardless of factors)
- [ ] **VIZ-02**: Grid highlights exactly the top-left `a×b` rectangle for the current multiplication

### Extended Tables

- [ ] **EXT-01**: Master-tier player can toggle "extended tables" (×11–×20) on/off from their account
- [ ] **EXT-02**: When extended mode is on, server selects problems with one factor 11–20 (other factor 2–10)
- [ ] **EXT-03**: Extended problems are scored using the standard tier multiplier system

## v2 Requirements (deferred)

### Account

- **ACCT-01**: Player can delete their own account via self-service UI
- **ACCT-02**: Player can view a data transparency page showing what is stored about them

### Security

- **SEC-11**: App uses targeted table subscriptions instead of subscribeToAllTables()

### Legal

- **LEGAL-01**: German Datenschutzerklärung page published
- **LEGAL-02**: German Impressum page published
- **LEGAL-03**: DPA template available for school partnerships

## Out of Scope

| Feature | Reason |
|---------|--------|
| Arithmetic expansion (add/subtract/divide) | After stable public launch |
| New game mechanics | Scope freeze until well-established in schools |
| App Store / Play Store release | Web-first |
| OAuth or email-based login | SpacetimeDB Identity sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIZ-01 | Phase 9 | Pending |
| VIZ-02 | Phase 9 | Pending |
| EXT-01 | Phase 10 | Pending |
| EXT-02 | Phase 10 | Pending |
| EXT-03 | Phase 10 | Pending |

**Coverage:**
- v1.1 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 — traceability confirmed after roadmap creation*
