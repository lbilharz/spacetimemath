# Architecture

**Analysis Date:** 2026-03-14

## Pattern Overview

**Overall:** Real-time SPA with SpaceTimeDB backend. Client-server event-driven sync architecture. State lives server-side; client subscribes to live tables and fires reducers for mutations.

**Key Characteristics:**
- **Serverless WASM module** on SpaceTimeDB maincloud (no traditional server to manage)
- **Reactive data sync** — client subscriptions to tables push updates automatically
- **Reducer-based mutations** — all writes go through server-side reducers, no direct table modifications
- **Tier-gated game progression** — adaptive mastery system with automatic unlock logic
- **Identity-based multiplayer** — SpaceTimeDB Identity (not passwords) determines player identity

## Layers

**Presentation Layer:**
- Purpose: React components and pages, user interactions, real-time UI updates
- Location: `client/src/components/` and `client/src/pages/`
- Contains: Page components (RegisterPage, LobbyPage, SprintPage), UI components (Leaderboard, MasteryGrid, BottomNav)
- Depends on: SpaceTimeDB React hooks (useTable, useReducer), i18next for i18n, module_bindings for type-safe table/reducer access
- Used by: App.tsx routes and renders all pages based on navigation state

**Application/Routing Layer:**
- Purpose: Single-page app navigation, state management, deep linking, page transitions
- Location: `client/src/App.tsx`
- Contains: Page state (current page, sprint session ID, classroom context), navigation helpers, browser history/URL sync
- Depends on: React hooks (useState, useEffect, useRef), SpaceTimeDB connection state
- Used by: main.tsx mounts App, all pages receive navigate callbacks

**Data Access Layer (Auto-generated):**
- Purpose: Type-safe bindings to server schema, reducers, and live subscriptions
- Location: `client/src/module_bindings/` (auto-generated from server, do not edit)
- Contains: Table accessors (tables.players, tables.sessions), reducer references (reducers.startSession), schema metadata
- Depends on: spacetimedb npm package (v2.0.0+)
- Used by: All pages and components query/mutate data through these bindings

**Business Logic/Utilities:**
- Purpose: Game mechanics, scoring, tier calculation, problem selection
- Location: `client/src/utils/learningTier.ts`, `client/src/utils/rechenwege.ts`, SprintPage problem selection
- Contains: Learning tier mapping (factorTier), difficulty weights, adaptive selection algorithm, German explanation generation
- Depends on: ProblemStat and Answer types
- Used by: SprintPage for adaptive problem selection, ResultsPage for tier unlock detection

**Server Module (Rust/WASM):**
- Purpose: Single source of truth for schema, mutations, tier logic, problem weights
- Location: `server/src/lib.rs`
- Contains: Tables (Player, Session, Answer, ProblemStat, etc.), reducers (startSession, submitAnswer, endSession), tier unlock logic
- Depends on: spacetimedb crate (v2.0.3)
- Used by: Client reducers call these, SpaceTimeDB runtime executes them, tables replicate to all clients

**Internationalization Layer:**
- Purpose: Multi-language support (English, German)
- Location: `client/src/i18n.ts`, `client/src/locales/`
- Contains: i18next config, language detection, locale JSON files
- Depends on: i18next, i18next-browser-languagedetector, react-i18next
- Used by: All components use useTranslation() hook

## Data Flow

**New Player Registration:**

1. User lands on app, sees RegisterPage (via App.tsx page routing)
2. Fills username → calls `reducers.register()` (Rust reducer on server)
3. Server creates Player table row, OnlinePlayer row, generates recovery key
4. Client receives Identity + token, stores in localStorage (auth.ts), updates SpaceTimeDB subscription
5. SpaceTimeDB React provider calls onConnect handler (main.tsx)
6. App detects myPlayer exists → auto-navigate from 'register' to 'lobby' page

**Sprint Session Flow:**

1. Player on LobbyPage clicks "Start Sprint" → calls `reducers.startSession()`
2. Server creates Session row with id, returns session_id to client
3. App.tsx stores sessionId, navigates to SprintPage
4. SprintPage subscribes to tables.answers (filtered by myIdentity), queries ProblemStat
5. Each answer submission calls `reducers.submitAnswer()` → server inserts Answer row
6. Client sees Answer appear in subscription, updates local UI
7. Timer expires → SprintPage calls `reducers.endSession()` (calculates score, tier unlock)
8. Server updates Session.isComplete = true, increments Player.learning_tier if mastered
9. Client sees Session update, navigates to ResultsPage
10. ResultsPage queries Session + Answer rows for sprint details

**Tier Unlock Detection:**

1. During endSession (server-side), tier unlock logic runs:
   - Queries all Answer rows for player
   - Checks mastery (80% accuracy) for all pairs in current tier
   - If mastered, increments Player.learning_tier
   - Inserts UnlockLog row for analytics
2. Client ResultsPage detects tier increase by comparing `effectivePlayer.learningTier` to `tierAtSprintStartRef`
3. Shows unlock animation, updates problem pool for next sprint

**Classroom Sprint Flow:**

1. Teacher on ClassroomPage calls `reducers.startClassSprint()`
2. Server creates ClassSprint row (isActive = true)
3. All enrolled students see class sprint alert (via App.tsx effect watching classSprints table)
4. Alert auto-navigates them to SprintPage with activeClassSprintId set
5. During sprint, answers tracked with classSprintId link
6. Teacher calls `reducers.endClassSprint()` → server marks isActive = false
7. Students navigate to ClassSprintResultsPage, see aggregate leaderboard

**Live Leaderboard Update:**

1. LobbyPage subscribes to tables.best_scores
2. After each session ends, server updates BestScore row (eliminates full scan at scale)
3. React hook re-renders Leaderboard with new top 10
4. Live list (who's online now) via OnlinePlayer table subscription

**State Management:**

- **Server-side persistent state:** All Player, Session, Answer, Classroom data lives in SpaceTimeDB tables
- **Client-side ephemeral state:** React useState for page navigation, form inputs, UI flags (splash screen, reconnect state)
- **LocalStorage:** Auth token, recovery key, user preferences (theme, language), joined-via-classroom flag
- **Refs:** tierAtSprintStartRef, myPlayerRef for event handlers to read current state without closure stale closure

## Key Abstractions

**Player (Identity):**
- Purpose: Represents a unique user, keyed by SpaceTimeDB Identity
- Examples: `server/src/lib.rs` Player table, `client/src/module_bindings/players_table.ts`
- Pattern: Fields track username, best_score, total_sessions, onboarding_done, learning_tier; Identity is primary key (unique per SpaceTimeDB account)

**Session:**
- Purpose: One sprint attempt; calculated scores and metrics
- Examples: `server/src/lib.rs` Session table
- Pattern: One Session per sprint; includes session_id, player_identity, weighted_score, raw_score, accuracy_pct, class_sprint_id link

**Answer:**
- Purpose: Single math problem answered in a session
- Examples: `server/src/lib.rs` Answer table
- Pattern: Immutable append-only; includes problem (a, b), user_answer, is_correct, response_ms for adaptive selection tuning

**ProblemStat:**
- Purpose: Community aggregated stats for each ordered pair; difficulty weight calculation
- Examples: `server/src/lib.rs` ProblemStat table
- Pattern: One row per pair (e.g., ×3 and ×4 tracked separately); attempt_count, correct_count feed into difficulty_weight formula

**Learning Tier:**
- Purpose: Gatekeeper for problem pool expansion
- Examples: `client/src/utils/learningTier.ts` learningTierOf()
- Pattern: Tier 0 (×1,2,5,10) → Tier 1 (+3,4) → Tier 2 (+6–9) → Tier 3 (11+); each tier unlocked at 80% mastery of previous

**OnlinePlayer:**
- Purpose: Live presence tracking; avoids full players table scan
- Examples: `server/src/lib.rs` OnlinePlayer, identity_connected/identity_disconnected reducers
- Pattern: Inserted on first connection, connection_count incremented on tab/reconnect, deleted when count reaches 0

**Classroom:**
- Purpose: Teacher-created group with enrollment, visibility control, live leaderboard
- Examples: `server/src/lib.rs` Classroom table, create_classroom reducer
- Pattern: Teacher is Identity, code is unique, visibility is hidden/public toggle; links to ClassroomMember via foreign key

## Entry Points

**Client:**
- Location: `client/src/main.tsx`
- Triggers: Browser loads app, app initializes
- Responsibilities: Mount React root, configure SpaceTimeDB connection with stored token, set up provider tree, handle native emoji fix for iOS

**App.tsx:**
- Location: `client/src/App.tsx`
- Triggers: React mounts App component after provider
- Responsibilities: Orchestrate navigation, subscribe to all live tables, manage page state, route to pages, handle browser history, reconnect guard

**Server Init:**
- Location: `server/src/lib.rs` init reducer
- Triggers: SpaceTimeDB module deploys
- Responsibilities: Seed problem_stats with difficulty weights, seed tier-1 extended pairs

**Client_Connected Reducer:**
- Location: `server/src/lib.rs` identity_connected
- Triggers: New WebSocket connects with Identity
- Responsibilities: Insert/update OnlinePlayer row, track connection count for multi-tab support

## Error Handling

**Strategy:** Graceful degradation with reconnection guard. Client catches SpaceTimeDB errors and shows subtle notification; if connection drops for 3 seconds after visibility returns, reload page.

**Patterns:**

- **Connection errors:** App.tsx shows "Connection error" splash with hint, onConnectError logs to console
- **Reducer failures:** Client catches, shows toast (if implemented), continues gracefully
- **Stale sessions:** LobbyPage filters sessions by connectedAt timestamp to ignore orphaned incomplete sessions
- **Tier unlock failures:** Server-side, caught and logged; player stays on completed tier if calc fails
- **Recovery key generation:** Fire-and-forget; happens in App.tsx useEffect, silently retries on next render

## Cross-Cutting Concerns

**Logging:** Console.error/warn in main.tsx for connection issues; server-side logging via spacetimedb log crate (visible in maincloud dashboard)

**Validation:**
- Client: Vite + TypeScript compile-time checking via module_bindings types
- Server: SpaceTimeDB reducer context enforces types at runtime; column defaults prevent null issues

**Authentication:**
- No passwords; SpaceTimeDB Identity (cryptographic, auto-generated) + token stored in localStorage
- Recovery key + transfer code allow device migration without passwords
- Token refreshed on each reconnection via capturedToken module

**Rate limiting:** Not explicitly implemented; SpaceTimeDB maincloud has per-database rate limits

**Analytics:** UnlockLog table tracks tier unlocks with timestamp; BestScore denormalization for fast leaderboard queries

---

*Architecture analysis: 2026-03-14*
