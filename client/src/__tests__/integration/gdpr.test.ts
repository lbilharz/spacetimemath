import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connect, waitFor, disconnect, type ConnectedClient } from '../helpers.js';

describe('delete_player', () => {
  // Each sub-describe gets its own connection so the first deletePlayer call
  // does not leave a second test with no registered player.

  describe('removes all player data', () => {
    let client: ConnectedClient;

    beforeAll(async () => {
      client = await connect();
      await client.conn.reducers.register({ username: 'deleteme-1' });
    }, 15_000);

    afterAll(() => {
      if (client?.conn) disconnect(client.conn);
    });

    it('player row is gone after deletePlayer', async () => {
      const idHex = client.identity.toHexString();

      // Verify player row exists before deletion
      await waitFor(() => {
        for (const p of client.conn.db.players.iter()) {
          if (p.identity.toHexString() === idHex) return p;
        }
      }, 5_000);

      // Call deletePlayer
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
  });

  describe('removes sessions for deleted player', () => {
    let client: ConnectedClient;

    beforeAll(async () => {
      client = await connect();
      await client.conn.reducers.register({ username: 'deleteme-2' });
    }, 15_000);

    afterAll(() => {
      if (client?.conn) disconnect(client.conn);
    });

    it('sessions are gone after deletePlayer', async () => {
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

      // Call deletePlayer
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

  // SEQ-06: sprint_sequences rows must be cascade-deleted when deletePlayer is called.
  // Table accessor: (client.conn.db as any).sprintSequences (bindings generated in Wave 2).
  it.todo('SEQ-06: deletePlayer cascade removes sprint_sequences rows');
});
