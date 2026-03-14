import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connect, waitFor, disconnect, type ConnectedClient } from '../helpers.js';

describe('delete_player', () => {
  let client: ConnectedClient;

  beforeAll(async () => {
    client = await connect();
    await client.conn.reducers.register({ username: 'deleteme' });
  }, 15_000);

  afterAll(() => {
    // Only disconnect if client was successfully connected
    if (client?.conn) disconnect(client.conn);
  });

  it('removes all player data', async () => {
    const idHex = client.identity.toHexString();

    // Verify player row exists before deletion
    await waitFor(() => {
      for (const p of client.conn.db.players.iter()) {
        if (p.identity.toHexString() === idHex) return p;
      }
    }, 5_000);

    // Call deletePlayer — this will throw "unknown reducer" until GDPR-01 is deployed
    // FAIL (RED): reducer does not exist yet in Plan 02-04
    await (client.conn.reducers as any).deletePlayer({});

    // After deletion, player row should be gone
    const deleted = await waitFor(() => {
      const rows = [...client.conn.db.players.iter()].filter(
        p => p.identity.toHexString() === idHex
      );
      return rows.length === 0 ? true : undefined;
    }, 5_000);

    expect(deleted).toBe(true);
  });

  it('removes sessions for deleted player', async () => {
    const idHex = client.identity.toHexString();

    // Start and end a session to create session data
    await client.conn.reducers.startSession({});
    const session = await waitFor(() => {
      for (const s of client.conn.db.sessions.iter()) {
        if (s.playerIdentity.toHexString() === idHex && !s.isComplete) return s;
      }
    }, 5_000);

    await client.conn.reducers.endSession({ sessionId: session.id });

    // Wait for session to be marked complete
    await waitFor(() => {
      for (const s of client.conn.db.sessions.iter()) {
        if (s.id === session.id && s.isComplete) return s;
      }
    }, 5_000);

    // Call deletePlayer — FAIL (RED) until Plan 04 deploys
    await (client.conn.reducers as any).deletePlayer({});

    // After deletion, no sessions should remain for this identity
    const noSessions = await waitFor(() => {
      const remaining = [...client.conn.db.sessions.iter()].filter(
        s => s.playerIdentity.toHexString() === idHex
      );
      return remaining.length === 0 ? true : undefined;
    }, 5_000);

    expect(noSessions).toBe(true);
  });
});
