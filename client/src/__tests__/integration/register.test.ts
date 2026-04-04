import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connect, waitFor, disconnect, type ConnectedClient } from '../helpers.js';

describe('register reducer', () => {
  let client: ConnectedClient;

  beforeAll(async () => {
    client = await connect();
    await client.conn.reducers.register({ username: 'reg_tester', playerType: { tag: 'Solo' }, email: undefined });
  }, 15_000);

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
    expect(player.totalSessions).toBe(0);
  });

  it('no BestScore row exists before any session is completed', () => {
    // best_scores rows are only created by end_session, not register.
    const idHex = client.identity.toHexString();
    const found = [...client.conn.db.best_scores.iter()].find(
      b => b.playerIdentity.toHexString() === idHex
    );
    expect(found).toBeUndefined();
  });

  it('calling register again updates the username (idempotent identity)', async () => {
    await client.conn.reducers.register({ username: 'reg_tester_v2', playerType: { tag: 'Solo' }, email: undefined });

    const idHex = client.identity.toHexString();
    const player = await waitFor(() => {
      for (const p of client.conn.db.players.iter()) {
        if (p.identity.toHexString() === idHex && p.username === 'reg_tester_v2') return p;
      }
    });

    expect(player.username).toBe('reg_tester_v2');
  });
});
