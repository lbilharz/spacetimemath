# Codebase Concerns

**Analysis Date:** 2026-03-14

## Tech Debt

**React Hook Dependencies — Pervasive Exhaustive-Deps Disables:**
- Issue: 15+ `eslint-disable react-hooks/exhaustive-deps` comments bypass dependency array validation across SprintPage, AccountPage, ClassroomPage, LobbyPage, and App.tsx. While intentional (refs + closures), this pattern masks potential stale-closure bugs.
- Files:
  - `client/src/App.tsx` (lines 101, 132, 197, 245)
  - `client/src/pages/SprintPage.tsx` (lines 204, 211, 262, 283, 290)
  - `client/src/pages/ClassroomPage.tsx` (lines 110, 122)
  - `client/src/pages/AccountPage.tsx` (lines 111, 124)
  - `client/src/pages/LobbyPage.tsx` (lines 88, 99)
  - `client/src/pages/RegisterPage.tsx` (appears in codebase)
- Impact: Difficult to refactor without accidentally breaking state logic; new team members may not understand why disables are necessary.
- Fix approach: Document the closure patterns (e.g., `myPlayerRef`, `sessionIdRef`) in a utility or guide. Consider wrapping in helper functions with explicit "stale closure intended" semantics.

**Large Components (>600 LOC):**
- Issue: ClassroomPage (693 LOC) and SprintPage (599 LOC) combine multiple responsibilities: state management, problem selection, timer logic, rendering, and class sprint coordination. Testing individual features requires loading entire component.
- Files:
  - `client/src/pages/ClassroomPage.tsx` (693 lines)
  - `client/src/pages/SprintPage.tsx` (599 lines)
- Impact: Harder to test, harder to debug, risk of unintended state coupling between features (e.g., timer logic affecting problem selection).
- Fix approach: Extract pure problem-selection algorithm and mastery-calculation logic into separate utilities with unit tests (`selectNextProblem`, `getMasteryLocal` already partially extracted). Consider separating class sprint UI from solo sprint UI into sub-components.

**Generated Module Bindings Not Version-Controlled Strategy:**
- Issue: `client/src/module_bindings/` (321 LOC auto-generated) contains raw TypeScript. No clear versioning or regeneration docs beyond "make generate". Changes to server schema require manual bindings sync.
- Files:
  - `client/src/module_bindings/index.ts` (321 lines, auto-generated)
  - All reducer/table files in `module_bindings/`
- Impact: Risk of schema/binding mismatch if codegen fails silently or server schema changes without client regen.
- Fix approach: Add pre-commit hook to validate schema compatibility or enforce regeneration on server changes. Document in ARCHITECTURE.md where these are auto-generated.

**Auth Token Stored as Module-Level Export:**
- Issue: `client/src/auth.ts` exports mutable global `capturedToken` accessed directly by other modules (AccountPage, App, integration tests). No encapsulation or getter/setter pattern.
- Files:
  - `client/src/auth.ts` (6 lines)
  - Usage in `client/src/pages/AccountPage.tsx` (lines 52, 137)
  - Usage in `client/src/App.tsx` (line 96)
- Impact: Token state can be accidentally mutated; no centralized place to add logging, validation, or expiry checks.
- Fix approach: Wrap in a class with getter/setter methods; add debug logging on token change; document how token lifecycle works (obtained at connect, cleared on logout).

---

## Test Coverage Gaps

**Integration Tests — Limited Sprint Scenarios:**
- What's not tested: Class sprint timeout behavior, diagnostic sprint problem generation, multi-tab sprint sync, reconnection during active sprint.
- Files:
  - `client/src/__tests__/integration/solo_sprint.test.ts` (exists but limited coverage implied by name)
  - `client/src/__tests__/integration/classroom.test.ts` (covers join/create, not sprint execution)
  - No integration test for class sprint execution flow
- Risk: Sprint timeout logic, problem selection weighting, and WS reconnection during sprint are not validated. Production bugs likely.
- Priority: High — sprint is core user experience.

**Unit Tests — Problem Selection Algorithm:**
- What's not tested: Edge cases in `selectNextProblem()` (SprintPage.tsx line 72), e.g., when `stats` is empty, when all problems are mastered, weight normalization, decimal precision issues.
- Files: `client/src/pages/SprintPage.tsx` (algorithm on lines 72–132)
- Risk: Random seed may produce incorrect problem distribution; edge cases could cause weight calculation to fail silently or produce NaN.
- Priority: Medium — algorithm is critical but currently untested.

**Account Page Email Recovery — No Error Handling Tests:**
- What's not tested: Email API failure modes (timeout, malformed email, server 5xx), partial failures (key generated but email fails).
- Files: `client/src/pages/AccountPage.tsx` (lines 72–90)
- Risk: User may think recovery email was sent when it failed; no visibility into API errors.
- Priority: Medium — affects account recovery.

**Classroom Teacher QR Generation — Not Tested:**
- What's not tested: QR code generation with student transfer codes, QR scans on real devices, malformed codes.
- Files: `client/src/pages/ClassroomPage.tsx` (lines 44–45 show QR usage)
- Risk: QR feature may be broken in production without user notice.
- Priority: Medium — less critical than sprint.

---

## Fragile Areas

**SprintPage Timer Synchronization (Class Sprints):**
- Files: `client/src/pages/SprintPage.tsx` (lines 193–283)
- Why fragile: Local timers (client) are synced with server `ClassSprint.startedAt` at both start and during countdown. Off-by-one-second errors or missed ticks can desync timer display. Multiple `setTimeLeft` calls in different useEffect blocks create race conditions.
- Safe modification: Consolidate timer logic into a single useEffect; add unit test for time delta calculation. Document the sync boundary (when client timer is allowed to drift vs. when it must snap to server).
- Test coverage: No tests for timer behavior; timer logic intertwined with rendering and session state.

**Problem Selection in SprintPage:**
- Files: `client/src/pages/SprintPage.tsx` (lines 72–132, 252–262)
- Why fragile: Weighted random selection depends on `eligibleStats` filtering by `playerLearningTier`. If tier data is stale or stats table is not fully loaded, selection may crash or bias. `lastKeyRef` is used to avoid repeats but is not reset on sprint restart.
- Safe modification: Add guards for empty stats; validate tier before filtering; reset refs on sprint start. Write unit tests for selection with empty, partial, and full stats arrays.
- Test coverage: None.

**Connection Error Handling in App.tsx:**
- Files: `client/src/App.tsx` (lines 248–262)
- Why fragile: `connectionError` and `!isActive && !effectivePlayer` both trigger splash screen, but logic is distinct. If connection drops mid-session, reconnect guard (lines 202–213) reloads the page after 3s. This is a hard refresh that loses state; no graceful reconnect or retry backoff.
- Safe modification: Add exponential backoff before reload; allow user to manually retry; persist session state to localStorage so it survives reload.
- Test coverage: None.

**ClassroomPage Auto-End Sprint Logic:**
- Files: `client/src/pages/ClassroomPage.tsx` (lines 100–110)
- Why fragile: Sprint auto-ends when `allSessionsComplete` becomes true. If a student reconnects after "finishing" but before teacher sees completion, the auto-end may fire prematurely. No debouncing or timeout to confirm completion.
- Safe modification: Add 1-second debounce or require all sessions complete + timer < 5s remaining before auto-ending. Write integration test simulating delayed student completion.
- Test coverage: None.

---

## Performance Bottlenecks

**Leaderboard Recomputation on Every Render (ClassroomPage):**
- Problem: Lines 82–98 recompute `liveLB` (top 5 leaderboard) on every render by iterating all sprint sessions, answers, and stats. No memoization. With 100+ students and 1000+ answers, this is O(n²) per tick.
- Files: `client/src/pages/ClassroomPage.tsx` (lines 82–98)
- Cause: Derived state computed inline instead of with `useMemo()`.
- Improvement path: Wrap in `useMemo([sprintAnswers, sprintSessions])` or move to separate hook. Add performance test for 100+ concurrent students.

**Answer Filtering by Session ID (ClassroomPage):**
- Problem: Line 74 creates `sprintSessionIdStrs` set, then line 199 filters all answers against it: `answers.filter(a => sprintSessionIdStrs.has(...))`. With 10K+ answers, this is O(n) per component mount.
- Files: `client/src/pages/ClassroomPage.tsx` (lines 73–74, 199)
- Cause: No pre-indexed lookup; full-table scan on every subscription update.
- Improvement path: Add index lookup in SpacetimeDB (if supported) or pre-compute answer groups keyed by session ID at subscription time.

**Recovery Key Lookup (Teacher Only):**
- Problem: Line 176–178 creates a map of recovery keys for all players every time recovery_keys table updates. O(n) iteration; with 1000+ students, repeated creation on each subscription tick.
- Files: `client/src/pages/ClassroomPage.tsx` (lines 174–179)
- Cause: No memoization or conditional update.
- Improvement path: Memoize map creation; only update when recovery_keys actually changes.

---

## Scaling Limits

**SpacetimeDB All-Tables Subscription:**
- Current capacity: Integration tests subscribe to 11 tables; client default is `subscribeToAllTables()`. Each new table doubles memory per client.
- Limit: At 100+ concurrent users, subscription payload and diff processing becomes a bottleneck.
- Scaling path: Implement targeted subscriptions (e.g., only subscribe to classrooms user is enrolled in, not all classrooms). Lazy-load problem_stats only on sprint start.

**Session + Answer Accumulation (No Pruning):**
- Current capacity: Sessions and answers grow unbounded; after 1 year of daily usage by 100 students, 36,500+ sessions and 1M+ answers are stored.
- Limit: Query performance degrades; leaderboard queries scan all-time best scores instead of seasonal.
- Scaling path: Archive old sessions/answers to cold storage after 1 year; implement seasonal leaderboards. Add database indexes on `playerIdentity` and `classSprintId`.

**Online Players Table:**
- Current capacity: `connection_count` tracks multiple tabs per user. If 1 user has 10 tabs open, table stays correct. But if 1000 users × 5 tabs average, 5K rows broadcast on every connect/disconnect.
- Limit: WebSocket churn at scale.
- Scaling path: Batch connection events; only broadcast top N online players instead of all.

---

## Missing Critical Features

**No Offline Mode:**
- Problem: App requires constant WebSocket. If connection drops for 30s, user sees "reconnecting" UI and eventually hard-refreshes. No cached sprint data or local-first queue.
- Blocks: Using app on transit, unreliable networks, school with poor WiFi.
- Workaround: None (current behavior is hard reload).

**No Sprint History Search/Filter:**
- Problem: User can view all their sessions on ProgressPage but cannot filter by date range or problem category. Leaderboard is global + classroom only; no seasonal/weekly leaderboards.
- Blocks: Reviewing performance over time, comparing scores to peers.

**No Rate Limiting / Brute-Force Protection:**
- Problem: No visible rate limit on register/login. Server may accept unlimited registration requests from same IP.
- Blocks: Scaling to public deployment; DDOS risk.

**No Accessibility Audit:**
- Problem: App uses emojis extensively (🌱🔨⚡🏆) with no alt text. Color contrast not validated. No keyboard navigation hints for iOS WKWebView workaround (lines 143–144 in SprintPage).
- Blocks: WCAG compliance; students with visual impairments cannot use app.

---

## Security Considerations

**Recovery Keys Stored in Plain Text (Public Table):**
- Risk: Recovery keys are stored in a public table accessible to any authenticated user. A compromised account with read access can see all users' recovery keys and reset their passwords.
- Files: `server/src/lib.rs` (RecoveryKey table definition around line 82 in earlier context; marked public)
- Current mitigation: Keys are 6-char random codes; brute force is expensive but feasible.
- Recommendations:
  - Make `recovery_keys` table private; only owner + server can read.
  - Add rate limiting on recovery key usage.
  - Hash keys in database; compare on request instead of returning plaintext.

**Transfer Codes Also Public:**
- Risk: Transfer codes (for account linking) are public. An attacker can scan active transfer codes and link accounts before legitimate user completes the transfer.
- Files: `server/src/lib.rs` (TransferCode table, line 50s context suggests it's public)
- Current mitigation: Codes expire after 1 hour (60 * 60 in AccountPage.tsx line 98).
- Recommendations:
  - Make transfer_codes private or rate-limit reads.
  - Reduce TTL to 5-10 minutes.
  - Require confirmation from both accounts before linking.

**No Validation of Email in Recovery Endpoint:**
- Risk: `/api/send-recovery-email` (AccountPage.tsx line 77) sends email to user-supplied address with no verification. Attacker can spam email addresses or impersonate users during account recovery.
- Files: `client/api/send-recovery-email.ts` (not read, but referenced)
- Current mitigation: Email endpoint requires auth token.
- Recommendations:
  - Rate limit by identity (not IP).
  - Log all email sends; alert on abuse.
  - Require user to confirm they control the email before sending.

**No CSRF Protection on Reducers:**
- Risk: SpacetimeDB reducers (e.g., `register`, `submitAnswer`) may lack CSRF protection if accessed via HTTP (not just WebSocket). Malicious site could trigger actions on behalf of authenticated user.
- Files: `server/src/lib.rs` (all reducer definitions)
- Current mitigation: Likely covered by SpacetimeDB SDK default; unclear.
- Recommendations:
  - Document SpacetimeDB CSRF behavior.
  - If exposed via HTTP, add request origin validation.

**No Input Validation on Username/Classroom Name:**
- Risk: Lines like `username.trim().to_string()` in `register` reducer don't sanitize; could accept XSS payloads or null bytes.
- Files: `server/src/lib.rs` (register reducer, line 390+)
- Current mitigation: Length check (1–24 chars) prevents obvious exploits; displayNames are rendered as text, not HTML.
- Recommendations:
  - Add regex validation (alphanumeric + common punctuation only).
  - Audit all string inputs for SQL injection (if database used directly).

---

## Known Bugs

**Timer Desync on Class Sprint After Refresh:**
- Symptoms: If student refreshes during a class sprint, timer may not align with teacher's timer due to clock skew or missed sync on reconnect.
- Files: `client/src/pages/SprintPage.tsx` (lines 193–203)
- Trigger: Refresh browser during active class sprint; teacher timer and student timer diverge.
- Workaround: Ignore minor drift (<5s) or hard refresh to sync.

**Recovery Key Not Generated on First Login if Network Fails:**
- Symptoms: New user registers, but if network drops before recovery key is created, user has no recovery method.
- Files: `client/src/App.tsx` (lines 93–101); `server/src/lib.rs` (auto-create in init or register)
- Trigger: Register → network drop → close app → reopen. Recovery key may not exist.
- Workaround: User must manually trigger recovery key generation from AccountPage.

**Classroom Join Race Condition with Duplicate Prevention:**
- Symptoms: User joins classroom, then quickly joins again; sometimes duplicate member rows appear briefly before idempotency kicks in.
- Files: `client/src/__tests__/integration/classroom.test.ts` (lines 72–87 test this but assume idempotency works)
- Trigger: Rapidly click "Join" or fast double-submit form.
- Workaround: None; server should reject duplicate joins atomically. Current test waits 300ms (line 78), suggesting race is known.

---

## Dependencies at Risk

**SpacetimeDB ^2.0.0 (Pinned to Major, Not Minor):**
- Risk: package.json specifies `"spacetimedb": "^2.0.0"`, allowing breaking changes in 2.x updates. Future 2.1.0 could change API or schema format.
- Impact: Codegen may fail; module_bindings/ may become incompatible.
- Migration plan: Pin to specific minor version (e.g., `^2.0.3`); test on each SpacetimeDB release before upgrading.

**React ^19.0.0 (Major Version Peer Dependency):**
- Risk: React 19 hooks behavior changes could affect exhaustive-deps disables or stale closures.
- Impact: Future React 19.x.x could change hook behavior; app may not work.
- Migration plan: Monitor React releases; test on new versions in staging before deploying to production.

**Resend ^6.9.3 (Third-Party Email Service):**
- Risk: If Resend service goes down or API changes, recovery email feature breaks silently.
- Impact: Users cannot recover accounts.
- Migration plan: Add fallback email provider (e.g., SendGrid); implement email queue with retry logic.

---

*Concerns audit: 2026-03-14*
