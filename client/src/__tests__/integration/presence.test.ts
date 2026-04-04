import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connect, waitFor, disconnect, type ConnectedClient } from '../helpers.js';

describe('online_players presence', () => {
  let client: ConnectedClient;

  beforeAll(async () => {
    client = await connect();
    await client.conn.reducers.register({ username: 'presence_tester', playerType: { tag: 'Solo' }, email: undefined });
  }, 15_000);

  afterAll(() => disconnect(client.conn));

  it('appears in online_players after registering', async () => {
    const idHex = client.identity.toHexString();
    const entry = await waitFor(() => {
      for (const p of client.conn.db.online_players.iter()) {
        if (p.identity.toHexString() === idHex) return p;
      }
    });
    expect(entry.username).toBe('presence_tester');
  });

  it('online_players entry reflects updated username after set_username', async () => {
    const idHex = client.identity.toHexString();
    await client.conn.reducers.setUsername({ newUsername: 'presence_renamed' });
    const entry = await waitFor(() => {
      for (const p of client.conn.db.online_players.iter()) {
        if (p.identity.toHexString() === idHex && p.username === 'presence_renamed') return p;
      }
    });
    expect(entry.username).toBe('presence_renamed');
  });

  it('disappears from online_players after disconnect', async () => {
    const idHex = client.identity.toHexString();
    const token = client.token;

    // Verify we are online before disconnecting
    const before = [...client.conn.db.online_players.iter()].find(
      p => p.identity.toHexString() === idHex
    );
    expect(before).toBeDefined();

    disconnect(client.conn);

    // Reconnect as a different identity to observe the disconnection
    const observer = await connect();
    try {
      // The disconnected identity should vanish from online_players
      await waitFor(() => {
        const still = [...observer.conn.db.online_players.iter()].find(
          p => p.identity.toHexString() === idHex
        );
        return still === undefined ? true : undefined;
      }, 10_000);
    } finally {
      disconnect(observer.conn);
    }

    // Reconnect the original client for afterAll cleanup (noop disconnect)
    client = await connect(token);
  }, 20_000);
});
