/**
 * Vitest global setup for integration tests.
 *
 * Points the test suite at the dedicated integration database on maincloud.
 * No local server is needed — each test creates a fresh identity so test
 * runs never interfere with each other or with production data.
 *
 * One-time setup: run `make publish-test` once whenever the server schema changes.
 * Override via env vars if you want to test against a local instance instead:
 *   TEST_STDB_URI=ws://127.0.0.1:3799 TEST_STDB_DB=test-spacetimemath npm run test:integration
 */

export async function setup(): Promise<void> {
  process.env.TEST_STDB_URI ??= 'wss://maincloud.spacetimedb.com';
  process.env.TEST_STDB_DB  ??= 'spacetimemath-test';
  console.log(`[test] ${process.env.TEST_STDB_URI} / ${process.env.TEST_STDB_DB}`);
}

export async function teardown(): Promise<void> {
  // nothing to tear down
}
