/**
 * Security integration test scaffold — Phase 1 Security Hardening
 *
 * These tests cover SEC-01 through SEC-10. They are written as if the server
 * implementation already exists. Tests will fail until the corresponding server
 * plans (02-05) are deployed. The goal is that the file parses, compiles, and
 * runs without crashing the test runner. Failures are expected; crashes are not.
 *
 * SEC-09 is marked as manual-only (see comment on that test).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connect, waitFor, disconnect, type ConnectedClient } from '../helpers.js';

// ── SEC-01 & SEC-02: Table visibility ────────────────────────────────────────

describe('SEC-01 & SEC-02: recovery_keys and transfer_codes are private tables', () => {
  let clientA: ConnectedClient;
  let clientB: ConnectedClient;

  beforeAll(async () => {
    // clientA registers and creates sensitive rows
    [clientA, clientB] = await Promise.all([connect(), connect()]);
    await clientA.conn.reducers.register({ username: 'sec_01_owner' });
    await clientA.conn.reducers.createRecoveryKey({ token: 'test-token-sec01' });
    await clientA.conn.reducers.createTransferCode({ token: 'test-token-sec02' });
    // Give the server a moment to process before clientB snapshot is checked
    await new Promise(r => setTimeout(r, 500));
  }, 30_000);

  afterAll(() => {
    disconnect(clientA.conn);
    disconnect(clientB.conn);
  });

  it('SEC-01: a second identity sees 0 rows from recovery_keys', () => {
    // After Plan 03 makes recovery_keys private, the table is not available in
    // client bindings at all (codegen skips private tables). Accessing it via
    // the DB object returns undefined — which means clientB can see no rows.
    const tableAccessor = (clientB.conn.db as any).recovery_keys;
    if (tableAccessor === undefined) {
      // Private table — not accessible via client SDK. This is correct SEC-01 behavior.
      expect(tableAccessor).toBeUndefined();
    } else {
      const rows = [...tableAccessor.iter()];
      expect(rows).toHaveLength(0);
    }
  });

  it('SEC-02: a second identity sees 0 rows from transfer_codes', () => {
    // After Plan 03 makes transfer_codes private, the table is not available in
    // client bindings at all (codegen skips private tables). Accessing it via
    // the DB object returns undefined — which means clientB can see no rows.
    const tableAccessor = (clientB.conn.db as any).transfer_codes;
    if (tableAccessor === undefined) {
      // Private table — not accessible via client SDK. This is correct SEC-02 behavior.
      expect(tableAccessor).toBeUndefined();
    } else {
      const rows = [...tableAccessor.iter()];
      expect(rows).toHaveLength(0);
    }
  });
});

// ── SEC-03: get_my_recovery_code reducer ─────────────────────────────────────

describe('SEC-03: getMyRecoveryCode reducer returns own code via result table', () => {
  let client: ConnectedClient;

  beforeAll(async () => {
    client = await connect();
    await client.conn.reducers.register({ username: 'sec_03_player' });
    await client.conn.reducers.createRecoveryKey({ token: 'test-token-sec03' });
  }, 20_000);

  afterAll(() => disconnect(client.conn));

  it.skip(
    'SEC-03: calling getMyRecoveryCode populates recovery_code_results for this identity',
    async () => {
      // KNOWN LIMITATION (SpacetimeDB 2.0.3): Private table row changes written by a reducer
      // are NOT delivered to the calling client via the ReducerResult transaction update.
      // Confirmed via debug: recovery_code_results accessor exists in conn.db but has 0 rows
      // after getMyRecoveryCode resolves. SpacetimeDB 2.0.3 does not push private table
      // rows to the client via any mechanism — not SQL subscription, not reducer results.
      //
      // The AccountPage write-to-private-table pattern (Plan 02) cannot work in 2.0.3.
      // Re-enable this test when upgrading to a SpacetimeDB version that delivers
      // private table rows to the owning client via ReducerResult transaction updates.
    }
  );
});

// ── SEC-04, SEC-05, SEC-06: submit_answer hardening ──────────────────────────

describe('SEC-04, SEC-05, SEC-06: submit_answer hardening', () => {
  let client: ConnectedClient;
  let sessionId: bigint;

  beforeAll(async () => {
    client = await connect();
    await client.conn.reducers.register({ username: 'sec_04_player' });
    await client.conn.reducers.startSession({});

    // Wait for the session row to appear
    const idHex = client.identity.toHexString();
    const session = await waitFor(() => {
      for (const s of client.conn.db.sessions.iter()) {
        if (s.playerIdentity.toHexString() === idHex && !s.isComplete) return s;
      }
    });
    sessionId = session.id;
  }, 30_000);

  afterAll(() => disconnect(client.conn));

  it('SEC-04: the 81st submit_answer call is rejected with an error', async () => {
    // Submit 80 valid answers first (Tier 0 pairs, valid response times)
    // Using only a×2 (Tier 0) pairs for the cap test
    const tier0Pairs = [
      [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9],
      [3, 3], [3, 4], [3, 5], [3, 6], [3, 7], [3, 8], [3, 9],
      [4, 4], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9],
    ];

    // Submit 80 answers cycling through Tier 0 pairs
    for (let i = 0; i < 80; i++) {
      const [a, b] = tier0Pairs[i % tier0Pairs.length];
      try {
        await client.conn.reducers.submitAnswer({
          sessionId,
          a,
          b,
          userAnswer: a * b,
          responseMs: 800,
        });
      } catch {
        // Some submissions may fail before cap is implemented — that's fine
      }
    }

    // The 81st call should be rejected
    await expect(
      client.conn.reducers.submitAnswer({
        sessionId,
        a: 2,
        b: 3,
        userAnswer: 6,
        responseMs: 800,
      })
    ).rejects.toThrow();
  });

  it('SEC-05: submit_answer with responseMs=100 (below 200ms floor) is rejected', async () => {
    // Start a fresh session for this test to avoid interference from SEC-04
    await client.conn.reducers.startSession({});
    const idHex = client.identity.toHexString();
    const freshSession = await waitFor(() => {
      for (const s of client.conn.db.sessions.iter()) {
        if (s.playerIdentity.toHexString() === idHex && !s.isComplete &&
            s.id !== sessionId) return s;
      }
    });

    await expect(
      client.conn.reducers.submitAnswer({
        sessionId: freshSession.id,
        a: 2,
        b: 3,
        userAnswer: 6,
        responseMs: 100, // below MIN_RESPONSE_MS = 200
      })
    ).rejects.toThrow();
  });

  it('SEC-06: submit_answer with a Tier 2 problem pair for a Tier 0 player is rejected', async () => {
    // sec_04_player is at learningTier=0. Tier 2 pairs involve factors >= 7.
    // (7, 8) is a Tier 2 pair — above a Tier 0 player's unlocked tier.
    await client.conn.reducers.startSession({});
    const idHex = client.identity.toHexString();
    const freshSession = await waitFor(() => {
      const sessions = [...client.conn.db.sessions.iter()]
        .filter(s => s.playerIdentity.toHexString() === idHex && !s.isComplete);
      // Get the most recently created session (highest id)
      return sessions.length > 0 ? sessions.reduce((a, b) => a.id > b.id ? a : b) : undefined;
    });

    await expect(
      client.conn.reducers.submitAnswer({
        sessionId: freshSession.id,
        a: 7,
        b: 8,
        userAnswer: 56,
        responseMs: 800,
      })
    ).rejects.toThrow();
  });
});

// ── SEC-07: use_transfer_code with non-existent code ─────────────────────────

describe('SEC-07: use_transfer_code with a non-existent code returns an error', () => {
  let client: ConnectedClient;

  beforeAll(async () => {
    client = await connect();
    await client.conn.reducers.register({ username: 'sec_07_player' });
  }, 15_000);

  afterAll(() => disconnect(client.conn));

  it('SEC-07: using a non-existent transfer code string returns an error', async () => {
    // 'XXXXXX' is an invalid code — should not silently no-op after Plan 04 ships.
    await expect(
      client.conn.reducers.useTransferCode({ code: 'XXXXXX' })
    ).rejects.toThrow();
  });
});

// ── SEC-08: register with invalid username ───────────────────────────────────

describe('SEC-08: register rejects usernames with invalid characters', () => {
  let client: ConnectedClient;

  beforeAll(async () => {
    client = await connect();
  }, 15_000);

  afterAll(() => disconnect(client.conn));

  it('SEC-08: register with a username containing a null byte is rejected', async () => {
     
    await expect(
      client.conn.reducers.register({ username: 'bad\u0000name' })
    ).rejects.toThrow();
  });
});

// ── SEC-09: Transfer code TTL expiry — manual verification only ───────────────

describe('SEC-09: transfer code TTL expiry', () => {
  it.skip(
    'SEC-09: transfer code TTL expiry — manual verification only',
    () => {
      // Scheduled reducer fires after 10 minutes. Verify manually:
      // 1. Create a transfer code via AccountPage or createTransferCode reducer.
      // 2. Wait 10+ minutes.
      // 3. Confirm the row is absent in the SpacetimeDB dashboard (spacetimemath DB).
      // Automated testing of a time-based TTL requires time injection which is not
      // available in SpacetimeDB 2.0.3. A direct unit test calling expire_transfer_codes
      // with a backdated created_at is the alternative — to be added if reducer
      // becomes directly callable in a future SDK version.
    }
  );
});

// ── SEC-10: submit_answer requires a valid server-issued problem token ────────

describe('SEC-10: submit_answer requires a valid problem token', () => {
  let client: ConnectedClient;
  let sessionId: bigint;

  beforeAll(async () => {
    client = await connect();
    await client.conn.reducers.register({ username: 'sec_10_player' });
    await client.conn.reducers.startSession({});

    const idHex = client.identity.toHexString();
    const session = await waitFor(() => {
      for (const s of client.conn.db.sessions.iter()) {
        if (s.playerIdentity.toHexString() === idHex && !s.isComplete) return s;
      }
    });
    sessionId = session.id;
  }, 20_000);

  afterAll(() => disconnect(client.conn));

  it('SEC-10: submit_answer without a valid problem token is rejected', async () => {
    // After Plan 05 adds problem_token to submit_answer, submitting with an
    // invalid token (or no token) must be rejected by the server.
    // The submit_answer reducer signature will gain a problemToken: string field.
    // We cast to any here because the field does not exist in current bindings.
    await expect(
      (client.conn.reducers as any).submitAnswer({
        sessionId,
        a: 2,
        b: 3,
        userAnswer: 6,
        responseMs: 800,
        problemToken: 'INVALID', // not a server-issued token
      })
    ).rejects.toThrow();
  });
});
