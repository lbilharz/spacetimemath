/**
 * STDB test client for Playwright E2E specs.
 *
 * Pattern: the BROWSER drives the user-facing flow (registers, plays the sprint).
 * This Node-side helper attaches to the SAME identity by reading the credentials
 * the browser saved in localStorage, then opens its own STDB connection with
 * that token. Both ends now see identical row-level subscriptions, so the spec
 * can assert backend state (Player, Session, BestScore) the user just produced.
 *
 * Env vars (set by playwright via .env.test or test:e2e:ci):
 *   VITE_SPACETIMEDB_URI – default ws://127.0.0.1:3000
 *   VITE_SPACETIMEDB_DB  – default spacetimemath
 */
import type { Page } from '@playwright/test';
import type { Identity } from 'spacetimedb';
import { DbConnection } from '../../../module_bindings/index.js';

const STDB_URI = process.env.VITE_SPACETIMEDB_URI
  ?? process.env.TEST_STDB_URI
  ?? 'wss://maincloud.spacetimedb.com';
const STDB_DB  = process.env.VITE_SPACETIMEDB_DB
  ?? process.env.TEST_STDB_DB
  ?? 'spacetimemath-test';

// Subscribe to the same scoped views the app uses, so backend assertions
// reflect what the user would see in the UI.
const E2E_TABLES = [
  'SELECT * FROM players',
  'SELECT * FROM best_scores',
  // Sessions & answers
  'SELECT * FROM my_sessions',
  'SELECT * FROM my_answers',
  'SELECT * FROM my_issued_problem_results_v_2',
  'SELECT * FROM my_next_problem_results_v_2',
  // Friends
  'SELECT * FROM my_friendships',
  'SELECT * FROM my_friend_invites',
  // Classrooms
  'SELECT * FROM my_classrooms',
  'SELECT * FROM my_classroom_members',
  'SELECT * FROM class_sprints',
  'SELECT * FROM my_classroom_sessions',
  // Account recovery
  'SELECT * FROM my_recovery_code_results',
  'SELECT * FROM my_restore_results',
];

export interface StdbTestClient {
  conn: DbConnection;
  identity: Identity;
  token: string;
}

/**
 * Open a pure Node-side STDB connection (no browser involved).
 * Useful for setting up server-side state (e.g. registering a Teacher identity)
 * before injecting credentials into a browser context.
 */
export function connectNode(token?: string): Promise<StdbTestClient> {
  return new Promise<StdbTestClient>((resolve, reject) => {
    const builder = DbConnection.builder()
      .withUri(STDB_URI)
      .withDatabaseName(STDB_DB);

    (token ? builder.withToken(token) : builder)
      .onConnect((conn, identity, tok) => {
        conn.subscriptionBuilder()
          .onApplied(() => resolve({ conn, identity, token: tok }))
          .onError((_ctx, err) => reject(new Error(`Subscription error: ${err}`)))
          .subscribe(E2E_TABLES);
      })
      .onConnectError((_ctx, err) => reject(err))
      .build();
  });
}

/**
 * Attach a Node-side STDB client to the identity the browser is currently
 * authenticated as. Call this AFTER the browser has registered (i.e. after
 * `spacetimemath_credentials` exists in localStorage).
 */
export async function connectAsBrowserSession(page: Page): Promise<StdbTestClient> {
  await page.waitForFunction(
    () => localStorage.getItem('spacetimemath_credentials') !== null,
    { timeout: 15_000 },
  );

  const token = await page.evaluate(() => {
    const raw = localStorage.getItem('spacetimemath_credentials');
    return raw ? (JSON.parse(raw).token as string) : null;
  });
  if (!token) throw new Error('No STDB credentials in browser localStorage');

  return new Promise<StdbTestClient>((resolve, reject) => {
    DbConnection.builder()
      .withUri(STDB_URI)
      .withDatabaseName(STDB_DB)
      .withToken(token)
      .onConnect((conn, identity, tok) => {
        conn.subscriptionBuilder()
          .onApplied(() => resolve({ conn, identity, token: tok }))
          .onError((_ctx, err) => reject(new Error(`Subscription error: ${err}`)))
          .subscribe(E2E_TABLES);
      })
      .onConnectError((_ctx, err) => reject(err))
      .build();
  });
}

/**
 * Legacy/draft API name kept for the existing spec. Prefer
 * `connectAsBrowserSession(page)` — the username argument is unused because
 * registration happens in the browser.
 */
export async function connectAsTestUser(
  _username: string,
  page?: Page,
): Promise<StdbTestClient> {
  if (!page) {
    throw new Error('connectAsTestUser now requires the Playwright page; ' +
      'call it AFTER the browser has registered. Prefer connectAsBrowserSession(page).');
  }
  return connectAsBrowserSession(page);
}

/**
 * Delete the test player on the server and disconnect. Safe to call in
 * afterEach even if the connection never opened.
 */
export async function cleanupTestUser(client: StdbTestClient | undefined): Promise<void> {
  if (!client) return;
  try {
    await (client.conn.reducers as any).deletePlayer({});
  } catch (err) {
    // Don't fail teardown if the player is already gone or the call races
    // with disconnect — the test result is what matters.
    console.warn('[e2e] deletePlayer during cleanup failed:', err);
  }
  try {
    client.conn.disconnect();
  } catch { /* ignore */ }
}

/**
 * Poll `getter` every 50 ms until it returns a defined value. Mirrors the
 * vitest integration helper so spec authors can use the same idiom.
 */
export async function waitFor<T>(
  getter: () => T | undefined | null,
  timeout = 5_000,
): Promise<T> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const v = getter();
    if (v !== undefined && v !== null) return v;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
}
