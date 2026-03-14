# Coding Conventions

**Analysis Date:** 2026-03-14

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `DotArray.tsx`, `Leaderboard.tsx`, `RegisterPage.tsx`)
- Utilities: camelCase (e.g., `rechenwege.ts`, `learningTier.ts`, `auth.js`)
- Tests: `<source>.test.ts` co-located with source files (e.g., `rechenwege.test.ts` lives next to `rechenwege.ts`)
- Integration tests: Descriptive verbs + noun (e.g., `register.test.ts`, `classroom.test.ts`, `solo_sprint.test.ts`)

**Functions:**
- camelCase throughout (e.g., `getRechenweg()`, `loadSavedToken()`, `waitFor()`)
- Exported utility functions use clear action verbs: `connect()`, `disconnect()`, `waitFor()`
- React hooks follow React pattern: `useSpacetimeDB()`, `useTable()`, `useTranslation()`

**Variables:**
- camelCase for all variables and constants
- Descriptive names: `bestScores`, `tierFilter`, `myIdentityHex`, `connectionError`
- Underscore prefix for intentionally unused parameters (e.g., `_myLearningTier`, `_conn`, `_ctx`)
- CONSTANT_CASE for true compile-time constants (e.g., `CREDS_KEY`, `TABBED_PAGES`, `PATH_MAP`, `TIER_EMOJI`)

**Types:**
- PascalCase for type names and interfaces (e.g., `Rechenweg`, `Props`, `ConnectedClient`, `BestScore`)
- Interfaces for component props: `interface Props { ... }`
- Type aliases for complex data: `type Page = 'register' | 'lobby' | ...`
- Use interfaces over types for object shapes; types for unions and primitives

## Code Style

**Formatting:**
- Vite + React default formatting (Prettier not explicitly configured, relying on ESLint defaults)
- ESLint config: `eslint.config.ts` in root of `client/`
- Import statements use `.js` extensions for ESM compatibility (`import ... from '../../module_bindings/index.js'`)

**Linting:**
- ESLint 9.0.0 with TypeScript support via `typescript-eslint`
- Config file: `/Users/lbi/Projects/spacetimemath/client/eslint.config.ts`
- React Hooks plugin: `eslint-plugin-react-hooks` ensures hooks rules compliance
- Ignored paths: `dist/`, `src/module_bindings/`, `scripts/`
- Rules:
  - `@typescript-eslint/no-explicit-any`: warn
  - `@typescript-eslint/no-unused-vars`: error, with underscore pattern for intentional omissions
  - React Hooks recommended config enforced

**TypeScript:**
- `strict: true` in `tsconfig.app.json`
- Target: ES2020
- JSX: react-jsx
- `noUnusedLocals: false` and `noUnusedParameters: false` to allow intentional omissions (marked with `_` prefix)
- Module detection: force (ensures all files treated as modules)

## Import Organization

**Order:**
1. React and framework imports (`import React from 'react'`, `import { useState } from 'react'`)
2. External libraries (`import { useTranslation } from 'react-i18next'`, `import { useSpacetimeDB } from 'spacetimedb/react'`)
3. Project bindings and generated code (`import { tables, reducers } from './module_bindings/index.js'`)
4. Local utilities and helpers (`import { capturedToken } from './auth.js'`, `import { getRechenweg } from './rechenwege.js'`)
5. Local components (`import RegisterPage from './pages/RegisterPage.js'`)
6. Styles (`import './i18n.js'`, `import './index.css'`)

**Path Aliases:**
- No path aliases configured; imports use relative paths with full `.js` extensions
- Example: `import { DbConnection } from '../module_bindings/index.js'`

## Error Handling

**Patterns:**
- React components use state for errors: `const [error, setError] = useState('')`
- Connection errors captured via SpacetimeDB provider callbacks:
  - `.onConnectError((_conn, err) => { console.error('[STDB] Connection error:', err); })`
  - `.onDisconnect((_conn, err) => { console.warn('[STDB] Disconnected:', err); })`
- Pages/components display errors to user: `{error && <div>{error}</div>}`
- Test helpers throw with descriptive messages:
  ```typescript
  throw new Error(`waitFor timed out after ${timeout}ms`);
  throw new Error(`Subscription error: ${err}`);
  ```
- Try-catch blocks used selectively for JSON parsing and token loading:
  ```typescript
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    return raw ? JSON.parse(raw).token : undefined;
  } catch { return undefined; }
  ```
- Reducer calls use `.catch()` for error propagation: `endClassSprint(...).catch(console.error)`

## Logging

**Framework:** Native `console` object only (no logger library)

**Patterns:**
- Use tagged prefixes for context: `console.error('[STDB] Connection error:', err)`
- Log levels:
  - `console.error()`: Connection errors, critical failures
  - `console.warn()`: Disconnections, degraded conditions
  - `console.log()`: Setup/initialization (test context): `console.log('[test] ${URI} / ${DB}')`
- Minimal logging in production code; mostly confined to connection lifecycle in `main.tsx`
- Test setup logs its configuration to help debugging: `/Users/lbi/Projects/spacetimemath/client/src/__tests__/global-setup.ts` logs test database URI

## Comments

**When to Comment:**
- Inline comments for non-obvious logic only (e.g., explaining why a swap is done: `const [small, big] = a <= b ? [a, b] : [b, a]`)
- Comments in test files explain the strategy being tested (visible in `rechenwege.test.ts` with section headers: `// ---------------------------------------------------------------------------`)
- JSDoc comments for exported functions with unclear purpose or complex parameters

**JSDoc/TSDoc:**
- JSDoc used for test helpers:
  ```typescript
  /**
   * Connect to the local test SpacetimeDB instance and wait until the initial
   * subscription state is fully loaded before resolving.
   *
   * Pass a previously obtained `token` to reconnect as the same identity.
   */
  export function connect(token?: string): Promise<ConnectedClient> { ... }
  ```
- JSDoc documents polling behavior:
  ```typescript
  /**
   * Poll `getter` every 50 ms until it returns a non-undefined value, then
   * return it. Throws if `timeout` ms elapse without a result.
   */
  export async function waitFor<T>(...): Promise<T> { ... }
  ```
- React component JSDoc for complex behaviors (e.g., DotArray opacity fade)

## Function Design

**Size:** Generally 20-80 lines for components; utilities under 20 lines when possible
- `getRechenweg()`: 138 lines (complex switch statement, justified)
- `Leaderboard`: 328 lines (large component with filtering, sorting, rendering logic)
- `App.tsx`: 443 lines (main router/state hub, justified)

**Parameters:**
- Prefer object destructuring for component props (all components use `interface Props`)
- Functions with 1-2 parameters use direct parameters
- Optional parameters use default values: `faded = false` in `DotArray`
- Timeout parameters use defaults: `timeout = 5_000` in `waitFor()`

**Return Values:**
- Explicit typed returns: `function connect(token?: string): Promise<ConnectedClient>`
- Consistent return object shapes for utilities: `Rechenweg` interface with `strategyKey`, `steps`, `hint`
- React components return JSX (implicit React.ReactElement)

## Module Design

**Exports:**
- Named exports for utilities: `export function getRechenweg(...)`, `export async function waitFor(...)`
- Default exports for React components: `export default function DotArray(...)`
- Interface exports for types: `export interface Rechenweg { ... }`
- Test suites use `describe()` and `it()` from vitest (not exported, used within test files)

**Barrel Files:**
- No explicit barrel files (index.js files) in source code
- Module bindings auto-generated from server: `/Users/lbi/Projects/spacetimemath/client/src/module_bindings/index.js`
- Test helpers exported as named functions: `export { connect, waitFor, disconnect }`

**Module Organization:**
- `/utils/`: Pure utility functions (math logic, helpers)
- `/components/`: React UI components
- `/pages/`: Full-page components (routable)
- `/types/`: Type definitions (e.g., i18next augmentation)
- `/locales/`: i18n translations
- `/__tests__/`: Test files (both unit and integration)
- Root files: `App.tsx` (main router), `main.tsx` (entry point), `auth.js` (token state), `i18n.ts` (i18n setup)

---

*Convention analysis: 2026-03-14*
