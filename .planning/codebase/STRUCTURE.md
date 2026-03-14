# Codebase Structure

**Analysis Date:** 2026-03-14

## Directory Layout

```
spacetimemath/
├── client/                          # React + Vite frontend (deployed to Vercel)
│   ├── src/
│   │   ├── main.tsx                 # React root, SpaceTimeDB provider init
│   │   ├── App.tsx                  # SPA shell, page routing, data subscriptions
│   │   ├── index.css                # Global styles (design tokens, layout, mobile)
│   │   ├── auth.ts                  # Shared module for SpaceTimeDB auth token
│   │   ├── i18n.ts                  # i18next config, language detection
│   │   ├── module_bindings/         # Auto-generated from server (DO NOT EDIT)
│   │   │   ├── index.ts             # Main barrel export: tables, reducers, DbConnection
│   │   │   ├── types.ts             # All table/reducer type definitions
│   │   │   ├── *_table.ts           # Each table schema (players_table, sessions_table, etc.)
│   │   │   └── *_reducer.ts         # Each reducer args schema (register_reducer, etc.)
│   │   ├── pages/                   # Full-page components (URL routable)
│   │   │   ├── RegisterPage.tsx      # New player sign-up (no password)
│   │   │   ├── LobbyPage.tsx         # Main hub: start sprint, classrooms, leaderboard
│   │   │   ├── SprintPage.tsx        # 60-second game loop, adaptive problem selection
│   │   │   ├── ResultsPage.tsx       # Sprint results, tier unlock alert
│   │   │   ├── ProgressPage.tsx      # Mastery grid heatmap of all answered pairs
│   │   │   ├── AccountPage.tsx       # Username change, recovery key, transfer code
│   │   │   ├── ClassroomsPage.tsx    # List of joined classrooms
│   │   │   ├── ClassroomPage.tsx     # Teacher/student view: roster, leaderboard, class sprints
│   │   │   └── ClassSprintResultsPage.tsx  # Results after class sprint ends
│   │   ├── components/              # Reusable UI components (not full pages)
│   │   │   ├── BottomNav.tsx         # Tab navigation (mobile)
│   │   │   ├── TopBar.tsx            # App header with tier emoji and player name
│   │   │   ├── Leaderboard.tsx       # Top 10 scores, tier filtering
│   │   │   ├── MasteryGrid.tsx       # Heatmap of answer accuracy per pair
│   │   │   ├── SplashGrid.tsx        # Decorative dot pattern for splash screen
│   │   │   ├── OnboardingOverlay.tsx # First-run tutorial overlay
│   │   │   ├── DotArray.tsx          # Renders inline dot diagrams
│   │   │   ├── ScoringGuide.tsx      # Explains difficulty-weighted scoring
│   │   │   └── SprintHistory.tsx     # List of past sessions
│   │   ├── utils/                   # Utility functions
│   │   │   ├── learningTier.ts       # Tier mapping: factorTier() and learningTierOf()
│   │   │   ├── rechenwege.ts         # German math step-by-step explanations
│   │   │   └── rechenwege.test.ts    # Unit tests for explanations
│   │   ├── types/
│   │   │   └── i18next.d.ts          # TypeScript augmentation for i18next keys
│   │   ├── locales/                 # Translation JSON files
│   │   │   ├── en/translation.json   # English strings
│   │   │   └── de/translation.json   # German strings
│   │   ├── __tests__/               # Test files (not co-located with source)
│   │   │   ├── global-setup.ts       # Vitest global setup (environment, mocks)
│   │   │   ├── helpers.ts            # Test utilities (mock data, fixtures)
│   │   │   └── integration/          # Integration tests (connect to maincloud-test db)
│   │   │       ├── register.test.ts
│   │   │       ├── solo_sprint.test.ts
│   │   │       ├── classroom.test.ts
│   │   │       └── presence.test.ts
│   │   └── index.html               # HTML entry point
│   ├── package.json                 # npm scripts, dependencies
│   ├── vite.config.ts               # Vite + Vitest config
│   ├── vitest.config.ts             # Integration test config (connects to maincloud)
│   ├── tsconfig.json                # TypeScript config
│   ├── .eslintrc.js                 # ESLint rules
│   ├── .prettierrc                  # Prettier formatting config
│   └── .env.local                   # Dev env vars (ws://127.0.0.1:3000 for local server)
├── server/                          # Rust WASM module (deployed to SpaceTimeDB maincloud)
│   ├── src/
│   │   └── lib.rs                   # Entire module: tables, reducers, tier logic
│   ├── Cargo.toml                   # Rust dependencies
│   └── target/                      # Build artifacts (wasm32-unknown-unknown, debug, release)
├── hooks/                           # Git hooks
│   └── pre-commit                   # Runs npm lint + npm test in client/ before commit
├── .planning/                       # GSD planning documents
│   └── codebase/                    # Architecture + conventions reference
├── Makefile                         # Build/deploy commands (make publish, make generate, make deploy)
├── README.md                        # Project overview
└── package-lock.json                # Dependency lock file (root level for npm ci)
```

## Directory Purposes

**`client/src/main.tsx`:**
- Purpose: App initialization entry point
- Contains: React root mount, SpaceTimeDB connection builder, localStorage token load, Capacitor native platform detection
- Key files: Imports from `./App.js` and `./module_bindings/index.js`

**`client/src/App.tsx`:**
- Purpose: SPA orchestrator and master data subscription manager
- Contains: Page routing logic (PATH_MAP, PAGE_PATH), all table subscriptions (useTable hooks), navigation state (currentPage, sessionId, classroomId), browser history sync, reconnect guard
- Key files: Imports all pages, components, and module_bindings

**`client/src/module_bindings/`:**
- Purpose: Auto-generated TypeScript API to server schema and reducers
- Contains: Do not edit; regenerated by `make generate` from server schema
- Key files: `index.ts` (barrel export), `types.ts` (all types), individual table/reducer files
- Generated by: `spacetime generate --lang typescript --out-dir ../client/src/module_bindings`

**`client/src/pages/`:**
- Purpose: Full-page components, each navigable via App.tsx routing
- Contains: RegisterPage (auth), LobbyPage (hub), SprintPage (game loop), ResultsPage (score/tier unlock), ProgressPage (mastery), AccountPage (settings), ClassroomsPage (list), ClassroomPage (class details), ClassSprintResultsPage (class scores)
- Naming: `*Page.tsx` convention; each exports a single React component

**`client/src/components/`:**
- Purpose: Reusable UI components (not full pages)
- Contains: Nav, headers, display components (Leaderboard, MasteryGrid), dialogs (OnboardingOverlay)
- Naming: `PascalCase.tsx` for React components

**`client/src/utils/`:**
- Purpose: Business logic and utility functions
- Contains: learningTier.ts (tier calculation), rechenwege.ts (German explanations), rechenwege.test.ts (unit tests)
- Key files: `learningTier.ts` exported functions: factorTier(), learningTierOf()

**`client/src/locales/`:**
- Purpose: Translation JSON files
- Contains: en/translation.json (English), de/translation.json (German)
- Pattern: Flat nested structure for i18next keys (e.g., `app.connectionError`, `leaderboard.title`)

**`client/src/__tests__/`:**
- Purpose: Test files (not co-located with source to avoid import confusion)
- Contains: global-setup.ts (Vitest config), helpers.ts (test utilities), integration/ subdirectory for integration tests
- Pattern: integration tests connect to maincloud-test database and test full flows

**`server/src/lib.rs`:**
- Purpose: Entire Rust WASM module (tables, reducers, init, migrations, tier logic)
- Contains: All database schema (structs with #[table]), all reducers (#[reducer]), initialization logic, tier unlock algorithms
- Key functions: init (seeding), register, startSession, submitAnswer, endSession (tier check), startClassSprint, endClassSprint

## Key File Locations

**Entry Points:**

- `client/src/main.tsx` — React root initialization, SpaceTimeDB connection setup
- `client/src/App.tsx` — SPA shell, page routing, master data subscriptions
- `server/src/lib.rs` — Rust module entry point (tables + reducers)

**Configuration:**

- `client/package.json` — npm scripts (dev, build, test, lint), dependencies
- `client/vite.config.ts` — Vite build config, Vitest unit test config
- `client/vitest.config.ts` — Vitest integration test config (targets maincloud-test)
- `client/tsconfig.json` — TypeScript compiler config
- `client/.eslintrc.js` — ESLint rules
- `server/Cargo.toml` — Rust dependencies (spacetimedb 2.0.3, log)
- `Makefile` — Root-level build/deploy commands (absolute paths, non-interactive)

**Core Logic:**

- `client/src/pages/SprintPage.tsx` — Game loop, adaptive problem selection algorithm
- `client/src/utils/learningTier.ts` — Tier-to-factors mapping, mastery unlock logic
- `server/src/lib.rs` — Tier check on endSession, score calculation with difficulty weights

**Testing:**

- `client/src/__tests__/helpers.ts` — Test fixtures, mock data, helper functions
- `client/src/__tests__/integration/` — Integration tests (connect to maincloud-test)
- `client/src/utils/rechenwege.test.ts` — Unit tests for German explanations

## Naming Conventions

**Files:**

- Pages: `*Page.tsx` (e.g., SprintPage.tsx)
- Components: `PascalCase.tsx` for React (e.g., Leaderboard.tsx, BottomNav.tsx)
- Utils: `camelCase.ts` (e.g., learningTier.ts, rechenwege.ts)
- Tests: `*.test.ts` (co-located or in `__tests__/`)
- Auto-generated: `*_table.ts`, `*_reducer.ts` (underscores from server schema)

**Directories:**

- Pages: `pages/` (all full-page components)
- Components: `components/` (reusable UI)
- Utils: `utils/` (business logic, helpers)
- Tests: `__tests__/` (separate from source)
- Bindings: `module_bindings/` (auto-generated, do not edit)
- Locales: `locales/{en,de}/` (translation JSON)

**Variables/Functions:**

- React components: PascalCase (e.g., `SprintPage`, `Leaderboard`)
- Functions: camelCase (e.g., `learningTierOf()`, `getMasteryLocal()`)
- Constants: UPPER_SNAKE_CASE (e.g., `DIAGNOSTIC_PHASE_SECS`, `PAGE_PATH`, `TIER_EMOJI`)
- Types: PascalCase (e.g., `Player`, `Session`, `Mastery`)
- React hooks: `use*` prefix (e.g., `useTranslation()`, `useTable()`, `useSTDBReducer()`)

## Where to Add New Code

**New Feature (e.g., daily quests):**

1. **Server schema + logic:** Add struct + reducer to `server/src/lib.rs`
   - Example: `#[table] pub struct DailyQuest { ... }` + `#[reducer] pub fn complete_daily_quest(...) { ... }`
2. **Regenerate bindings:** Run `make generate`
3. **Client page:** Add `client/src/pages/QuestsPage.tsx`
4. **Client component:** Add `client/src/components/QuestCard.tsx` for reusable quest display
5. **Add route:** Update `App.tsx` PAGE_MAP, PAGE_PATH, render condition
6. **Add nav:** Update `BottomNav.tsx` or `TopBar.tsx` tabs
7. **Tests:** Add `client/src/__tests__/integration/quests.test.ts`

**New Component/Module:**

1. **Implementation:** `client/src/components/MyComponent.tsx` or `client/src/utils/myUtil.ts`
2. **Co-located test (if unit testable):** `client/src/utils/myUtil.test.ts`
3. **Export:** If utility, no special export needed; if component, import in pages/App
4. **i18n strings:** Add keys to `client/src/locales/en/translation.json` and `de/translation.json`

**Utilities:**

- Shared helpers: `client/src/utils/` (e.g., calculation, formatting, validation)
- Game mechanics: `server/src/lib.rs` or `client/src/utils/` depending on scope
- Type definitions: `client/src/module_bindings/types.ts` (auto-generated); never edit manually
- Test helpers: `client/src/__tests__/helpers.ts`

**Translations:**

- Add keys to both `client/src/locales/en/translation.json` and `de/translation.json`
- Use nested structure (e.g., `"app": { "title": "1UP" }` → access via `t('app.title')`)

## Special Directories

**`client/src/module_bindings/`:**
- Purpose: Auto-generated API to server schema
- Generated: `spacetime generate --lang typescript --out-dir ../client/src/module_bindings`
- Committed: Yes (to git for reproducible builds)
- Edit: Never; regenerate when server schema changes via `make generate`

**`client/src/__tests__/integration/`:**
- Purpose: Integration tests that connect to maincloud-test database
- Committed: Yes
- Run: `npm run test:integration` (separate from unit tests)
- Setup: `global-setup.ts` initializes test player identity, helpers.ts provides fixtures

**`server/target/wasm32-unknown-unknown/release/`:**
- Purpose: Compiled WASM binary, uploaded to maincloud
- Generated: `cargo build --target wasm32-unknown-unknown --release`
- Committed: No (.gitignore excludes target/)
- Publish: `spacetime publish spacetimemath --server maincloud --bin-path target/wasm32-unknown-unknown/release/spacetimemath.wasm`

**`client/node_modules/`:**
- Purpose: npm dependencies
- Generated: `npm install` or `npm ci`
- Committed: No
- Lock: `package-lock.json` committed for reproducibility

**`.planning/codebase/`:**
- Purpose: GSD codebase reference documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Committed: Yes
- Edit: Updated when architecture changes
- Used by: `/gsd:plan-phase` and `/gsd:execute-phase` commands

## Path Aliases

**TypeScript baseUrl:** Not configured in tsconfig.json (uses relative imports everywhere)

**Vite:**
- No path aliases configured; all imports are relative (e.g., `../module_bindings/index.js`, `../components/Leaderboard.js`)

---

*Structure analysis: 2026-03-14*
