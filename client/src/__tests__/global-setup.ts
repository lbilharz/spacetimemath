/**
 * Vitest global setup for integration tests.
 *
 * Starts an in-memory SpacetimeDB instance on a fixed local port, publishes
 * the pre-built WASM module, then tears everything down after all tests finish.
 *
 * Prerequisites: WASM must be built (`make publish` or `cargo build --target
 * wasm32-unknown-unknown --release` inside server/).
 */
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { ChildProcess } from 'node:child_process';

const SPACETIME = '/Users/lbi/.local/bin/spacetime';
const PORT      = 3799;
const DB_NAME   = 'test-spacetimemath';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname = client/src/__tests__ → 3 levels up = project root
const WASM_PATH = path.resolve(__dirname, '../../../server/target/wasm32-unknown-unknown/release/spacetimemath.wasm');

let serverProcess: ChildProcess;

async function waitForServer(maxWaitMs = 15_000): Promise<void> {
  const url = `http://127.0.0.1:${PORT}`;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      // Any HTTP response (even 404) means the server is up
      if (res.status < 600) return;
    } catch {
      // ECONNREFUSED — server not up yet
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`SpacetimeDB did not start within ${maxWaitMs}ms`);
}

export async function setup(): Promise<void> {
  if (!existsSync(WASM_PATH)) {
    throw new Error(
      `WASM not found at ${WASM_PATH}.\n` +
      `Run: cd server && cargo build --target wasm32-unknown-unknown --release`
    );
  }

  serverProcess = spawn(
    SPACETIME,
    ['start', '--in-memory', '--non-interactive', `--listen-addr=127.0.0.1:${PORT}`],
    { stdio: 'pipe', detached: false }
  );

  serverProcess.on('error', (err) => {
    console.error('[STDB] Failed to start:', err);
  });

  await waitForServer();

  execSync(
    `${SPACETIME} publish ${DB_NAME} --server http://127.0.0.1:${PORT} --bin-path ${WASM_PATH} -y`,
    { stdio: 'pipe' }
  );

  process.env.TEST_STDB_URI = `ws://127.0.0.1:${PORT}`;
  process.env.TEST_STDB_DB  = DB_NAME;
}

export async function teardown(): Promise<void> {
  serverProcess?.kill('SIGTERM');
}
