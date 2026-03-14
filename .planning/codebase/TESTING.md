# Testing Patterns

**Analysis Date:** 2026-03-14

## Test Framework

**Runner:**
- Vitest 4.1.0
- Config: `/Users/lbi/Projects/spacetimemath/client/vite.config.ts` (for unit tests)
- Integration config: `/Users/lbi/Projects/spacetimemath/client/vitest.integration.config.ts` (separate setup)

**Assertion Library:**
- Vitest built-in assertions via `expect()`

**Run Commands:**
```bash
npm test                      # Run unit tests (via vite.config.ts)
npm run test:integration     # Run integration tests (via vitest.integration.config.ts)
```

**Test Environment:**
- `environment: 'node'` (tests run in Node.js, not browser)
- `globals: true` (vitest/globals imported automatically, no need for imports)

## Test File Organization

**Location:**
- Unit tests: Co-located with source (e.g., `src/utils/rechenwege.test.ts` next to `src/utils/rechenwege.ts`)
- Integration tests: `src/__tests__/integration/` directory
  - Separated by feature: `register.test.ts`, `classroom.test.ts`, `solo_sprint.test.ts`, `presence.test.ts`

**Naming:**
- Unit tests: `<module>.test.ts` (matches source filename)
- Integration tests: Descriptive verb + feature (e.g., `register.test.ts`, `solo_sprint.test.ts`)

**Structure:**
```
client/
├── src/
│   ├── utils/
│   │   ├── rechenwege.ts
│   │   └── rechenwege.test.ts          # Co-located unit test
│   ├── pages/
│   ├── components/
│   └── __tests__/
│       ├── global-setup.ts             # Vitest global setup hook
│       ├── helpers.ts                  # Shared test helpers
│       └── integration/
│           ├── register.test.ts
│           ├── classroom.test.ts
│           ├── solo_sprint.test.ts
│           └── presence.test.ts
├── vite.config.ts                      # Unit test config
├── vitest.integration.config.ts        # Integration test config
└── tsconfig.test.json                  # TypeScript config for test files
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connect, waitFor, disconnect, type ConnectedClient } from '../helpers.js';

describe('register reducer', () => {
  let client: ConnectedClient;

  beforeAll(async () => {
    client = await connect();
    await client.conn.reducers.register({ username: 'reg_tester' });
  }, 15_000);  // 15 second timeout for async setup

  afterAll(() => disconnect(client.conn));

  it('creates a Player row with the correct username', async () => {
    const idHex = client.identity.toHexString();
    const player = await waitFor(() => {
      for (const p of client.conn.db.players.iter()) {
        if (p.identity.toHexString() === idHex) return p;
      }
    });

    expect(player.username).toBe('reg_tester');
    expect(player.learningTier).toBe(0);
    expect(player.onboardingDone).toBe(false);
  });
});
```

**Patterns:**
- Setup: `beforeAll()` with generous timeouts (15,000ms for connection setup, 20,000ms for multi-client tests)
- Teardown: `afterAll()` calls `disconnect()` to clean up connections
- Assertion: `expect(value).toBe(expected)` for equality, `expect(value).toHaveLength(n)` for arrays, `expect(value).toMatch(/regex/)` for strings
- Async patterns: Tests declared `async`, use `await` for reducers and helpers
- Shared state: Variables declared in outer scope (`let client`), populated in `beforeAll()`, used across tests in same suite

## Mocking

**Framework:**
- No external mocking library (mock, jest, sinon) configured
- Manual mocking via connection helpers and test fixtures

**Patterns:**
```typescript
// Connection polling pattern (manually polls database)
export async function waitFor<T>(
  getter: () => T | undefined,
  timeout = 5_000,
): Promise<T> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const val = getter();
    if (val !== undefined) return val;
    await new Promise(r => setTimeout(r, 50));  // Poll every 50ms
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
}

// Usage: Repeatedly query database until result appears
const player = await waitFor(() => {
  for (const p of client.conn.db.players.iter()) {
    if (p.identity.toHexString() === idHex) return p;
  }
});
```

**What to Mock:**
- External connections: Use test instance via helpers (`connect()` creates isolated test identity)
- Database queries: Polling via `waitFor()` until state appears in subscribed tables
- Reducer calls: Actual reducer invocation: `await client.conn.reducers.register({ username: 'test' })`

**What NOT to Mock:**
- Database: Real test database on maincloud (isolates test identity, prevents cross-test contamination)
- Connections: Real SpacetimeDB connections (integration tests verify reducer logic end-to-end)
- Time: Real timeouts (let tests wait naturally for eventual consistency)

## Fixtures and Factories

**Test Data:**
Unit tests use inline constants:
```typescript
// From rechenwege.test.ts
const TIER_EMOJI = ['🌱', '🔨', '⚡', '🏆'];

// Helper function reused across tests
function result(a: number, b: number) {
  return a * b;
}

// Loop-based parametrized test
for (let n = 2; n <= 9; n++) {
  const r = getRechenweg(15, n);
  const last = r.steps.at(-1)!;
  expect(last).toContain(`= ${result(15, n)}`);
}
```

Integration tests create fresh identities per connection:
```typescript
// Each call to connect() creates a new identity (no reuse)
const client = await connect();  // New identity
await client.conn.reducers.register({ username: 'reg_tester' });

// Can reuse a token to reconnect with same identity
const client2 = await connect(token);  // Reuses identity via token
```

**Location:**
- Unit test fixtures: Inline in test file
- Integration test helpers: `/Users/lbi/Projects/spacetimemath/client/src/__tests__/helpers.ts`
  - `connect()`: Creates new isolated connection with new identity
  - `waitFor()`: Polls for database state
  - `disconnect()`: Cleans up connection

## Coverage

**Requirements:** No coverage target enforced (no coverage config in vitest settings)

**View Coverage:** Not configured; no coverage command exposed in `package.json`

**State:** No coverage threshold defined, coverage tracking omitted by design

## Test Types

**Unit Tests:**
- Scope: Pure functions with deterministic output
- Examples: `rechenwege.test.ts` tests `getRechenweg()` with various multiplication factors
- Approach: Direct function call, assert output shape and values
- Isolation: No external dependencies; tests run locally with node environment
- Example test:
  ```typescript
  describe('×2', () => {
    it('shows big + big', () => {
      const r = getRechenweg(2, 7);
      expect(r.steps[0]).toBe('7 + 7 = 14');
      expect(r.strategyKey).toBe('rechenweg.double');
    });
  });
  ```

**Integration Tests:**
- Scope: SpacetimeDB reducer logic, multi-step flows, database state
- Examples: `register.test.ts`, `classroom.test.ts`, `solo_sprint.test.ts`
- Approach: Connect to test database, invoke reducers, poll for resulting state
- Isolation: Each test uses fresh identity; test database isolated from production
- Configuration: `vitest.integration.config.ts`
  - `fileParallelism: false` (tests run sequentially to avoid port/state conflicts)
  - `testTimeout: 30_000, hookTimeout: 30_000` (generous timeouts for network/database operations)
  - `globalSetup: ['src/__tests__/global-setup.ts']` (loads test database URI from env vars)
- Example test:
  ```typescript
  describe('register reducer', () => {
    let client: ConnectedClient;
    beforeAll(async () => {
      client = await connect();
      await client.conn.reducers.register({ username: 'reg_tester' });
    }, 15_000);

    it('creates a Player row with the correct username', async () => {
      const idHex = client.identity.toHexString();
      const player = await waitFor(() => {
        for (const p of client.conn.db.players.iter()) {
          if (p.identity.toHexString() === idHex) return p;
        }
      });
      expect(player.username).toBe('reg_tester');
    });
  });
  ```

**E2E Tests:**
- Framework: Not configured; integration tests serve this role
- Status: E2E via Capacitor iOS app handled separately (not in vitest)

## Common Patterns

**Async Testing:**
```typescript
// Integration tests are async
it('creates a Player row with the correct username', async () => {
  const idHex = client.identity.toHexString();

  // await connection setup
  const client = await connect();

  // await reducer invocation
  await client.conn.reducers.register({ username: 'test' });

  // await polling for result
  const player = await waitFor(() => {
    for (const p of client.conn.db.players.iter()) {
      if (p.identity.toHexString() === idHex) return p;
    }
  });

  expect(player.username).toBe('test');
});

// Setup hooks also async
beforeAll(async () => {
  client = await connect();
  await client.conn.reducers.register({ username: 'reg_tester' });
}, 15_000);  // Explicit timeout
```

**Error Testing:**
```typescript
// Timeout errors
it('throws if condition not met within timeout', async () => {
  const promise = waitFor(() => undefined, 100);  // Always returns undefined
  await expect(promise).rejects.toThrow(/timed out after 100ms/);
});

// Connection errors caught in helpers
export function connect(token?: string): Promise<ConnectedClient> {
  return new Promise((resolve, reject) => {
    builder
      .onConnectError((_ctx, err) => reject(err))  // Explicit rejection
      .onError((_ctx, err) => reject(new Error(`Subscription error: ${err}`)))
      .build();
  });
}
```

**Parametrized Tests (Loops):**
```typescript
// rechenwege.test.ts uses loop-based parametrization
describe('×15', () => {
  it('gives the right answer for all single-digit factors', () => {
    for (let n = 2; n <= 9; n++) {
      const r = getRechenweg(15, n);
      const last = r.steps.at(-1)!;
      expect(last).toContain(`= ${result(15, n)}`);
    }
  });
});
```

## Test Execution

**Configuration Overview:**
- Unit tests: `vite.config.ts` defines `test: { environment: 'node', globals: true, exclude: [...], ... }`
- Integration tests: `vitest.integration.config.ts` with `fileParallelism: false`, generous timeouts, global setup
- Test TypeScript: `tsconfig.test.json` extends `tsconfig.app.json` with vitest globals

**Global Setup:**
```typescript
// src/__tests__/global-setup.ts
export async function setup(): Promise<void> {
  process.env.TEST_STDB_URI ??= 'wss://maincloud.spacetimedb.com';
  process.env.TEST_STDB_DB  ??= 'spacetimemath-test';
  console.log(`[test] ${process.env.TEST_STDB_URI} / ${process.env.TEST_STDB_DB}`);
}

// Can override locally:
// TEST_STDB_URI=ws://127.0.0.1:3799 TEST_STDB_DB=test-spacetimemath npm run test:integration
```

---

*Testing analysis: 2026-03-14*
