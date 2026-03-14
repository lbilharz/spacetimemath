import { DbConnection } from '../module_bindings/index.js';
import type { Identity } from 'spacetimedb';

// All tables we subscribe to in tests — must not mix with subscribeToAllTables()
// NOTE: recovery_keys and transfer_codes are private after Plan 03; removed from this list.
// Private tables (recovery_code_results, transfer_code_results) cannot be subscribed to via
// SELECT * — SpacetimeDB pushes private table rows automatically to the owning identity.
const ALL_TABLES = [
  'SELECT * FROM players',
  'SELECT * FROM sessions',
  'SELECT * FROM answers',
  'SELECT * FROM best_scores',
  'SELECT * FROM classrooms',
  'SELECT * FROM classroom_members',
  'SELECT * FROM class_sprints',
  'SELECT * FROM problem_stats',
  'SELECT * FROM online_players',
];

export interface ConnectedClient {
  conn: DbConnection;
  identity: Identity;
  token: string;
}

/**
 * Connect to the local test SpacetimeDB instance and wait until the initial
 * subscription state is fully loaded before resolving.
 *
 * Pass a previously obtained `token` to reconnect as the same identity.
 */
export function connect(token?: string): Promise<ConnectedClient> {
  return new Promise((resolve, reject) => {
    const builder = DbConnection.builder()
      .withUri(process.env.TEST_STDB_URI!)
      .withDatabaseName(process.env.TEST_STDB_DB!);

    (token ? builder.withToken(token) : builder)
      .onConnect((conn, identity, tok) => {
        conn.subscriptionBuilder()
          .onApplied(() => resolve({ conn, identity, token: tok }))
          .onError((_ctx, err) => reject(new Error(`Subscription error: ${err}`)))
          .subscribe(ALL_TABLES);
      })
      .onConnectError((_ctx, err) => reject(err))
      .build();
  });
}

/**
 * Poll `getter` every 50 ms until it returns a non-undefined value, then
 * return it. Throws if `timeout` ms elapse without a result.
 */
export async function waitFor<T>(
  getter: () => T | undefined,
  timeout = 5_000,
): Promise<T> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const val = getter();
    if (val !== undefined) return val;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
}

export function disconnect(conn: DbConnection): void {
  conn.disconnect();
}
