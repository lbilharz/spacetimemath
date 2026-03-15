import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connect, waitFor, disconnect, type ConnectedClient } from '../helpers.js';

/**
 * Tier-0 pairs only: both factors from {1, 2, 10}.
 * Tier ladder: ×1/×2/×10 (tier 0) → ×3 (tier 1) → ×5 (tier 2) → …
 * Fresh players start at learning_tier = 0 (SEC-06 rejects higher-tier pairs).
 * 4 correct answers, 0 wrong answers.
 */
const ANSWERS = [
  { a: 2, b: 2,  userAnswer: 4,  responseMs: 800 },
  { a: 1, b: 2,  userAnswer: 2,  responseMs: 750 },
  { a: 1, b: 10, userAnswer: 10, responseMs: 900 },
  { a: 2, b: 10, userAnswer: 20, responseMs: 850 },
];

/**
 * SEC-10: issue a problem and return the server-issued token so it can be
 * passed to submitAnswer.
 */
async function getToken(
  client: ConnectedClient,
  sessionId: bigint,
  a: number,
  b: number,
): Promise<string> {
  await client.conn.reducers.issueProblem({ sessionId, a, b });
  const result = await waitFor(() => {
    for (const r of client.conn.db.issued_problem_results.iter()) {
      if (r.owner.toHexString() === client.identity.toHexString()) return r;
    }
  }, 5_000);
  return result.token;
}

describe('solo sprint (start → submit → end)', () => {
  let client: ConnectedClient;
  let sessionId: bigint;

  beforeAll(async () => {
    client = await connect();
    await client.conn.reducers.register({ username: 'sprinter' });
  }, 15_000);

  afterAll(() => disconnect(client.conn));

  it('start_session creates an incomplete Session row', async () => {
    const idHex = client.identity.toHexString();
    await client.conn.reducers.startSession({});

    const session = await waitFor(() => {
      for (const s of client.conn.db.sessions.iter()) {
        if (s.playerIdentity.toHexString() === idHex && !s.isComplete) return s;
      }
    });

    sessionId = session.id;
    expect(session.classSprintId).toBe(0n);   // solo sprint
    expect(session.weightedScore).toBe(0);
    expect(session.totalAnswered).toBe(0);
  });

  it('submit_answer records correct answers and increments totalAnswered', async () => {
    for (const ans of ANSWERS) {
      const token = await getToken(client, sessionId, ans.a, ans.b);
      await client.conn.reducers.submitAnswer({ sessionId, ...ans, problemToken: token });
    }

    const idHex = client.identity.toHexString();
    // Wait until all 4 answers are recorded
    const answers = await waitFor(() => {
      const all = [...client.conn.db.answers.iter()].filter(
        a => a.playerIdentity.toHexString() === idHex
      );
      return all.length >= ANSWERS.length ? all : undefined;
    });

    const correct = answers.filter(a => a.isCorrect);
    expect(correct).toHaveLength(ANSWERS.length); // all 4 are correct
  });

  it('wrong answer is recorded as isCorrect = false', async () => {
    const idHex = client.identity.toHexString();
    // Use a tier-0 pair (a:1, b:2) with a deliberate wrong answer
    const token = await getToken(client, sessionId, 1, 2);
    await client.conn.reducers.submitAnswer({ sessionId, a: 1, b: 2, userAnswer: 99, responseMs: 1000, problemToken: token });

    const wrong = await waitFor(() => {
      for (const a of client.conn.db.answers.iter()) {
        if (a.playerIdentity.toHexString() === idHex && !a.isCorrect) return a;
      }
    });

    expect(wrong.a).toBe(1);
    expect(wrong.b).toBe(2);
    expect(wrong.userAnswer).toBe(99);
  });

  it('end_session marks session complete and sets a positive weightedScore', async () => {
    await client.conn.reducers.endSession({ sessionId });

    const session = await waitFor(() => {
      for (const s of client.conn.db.sessions.iter()) {
        if (s.id === sessionId && s.isComplete) return s;
      }
    });

    expect(session.isComplete).toBe(true);
    expect(session.weightedScore).toBeGreaterThan(0);
    expect(session.totalAnswered).toBe(ANSWERS.length + 1); // 4 correct + 1 wrong
  });

  it('Player.totalSessions increments after end_session', async () => {
    const idHex = client.identity.toHexString();
    const player = await waitFor(() => {
      for (const p of client.conn.db.players.iter()) {
        if (p.identity.toHexString() === idHex && p.totalSessions > 0) return p;
      }
    });

    expect(player.totalSessions).toBe(1);
    expect(player.totalCorrect).toBe(ANSWERS.length); // 4 correct answers
  });

  it('BestScore is updated after end_session', async () => {
    const idHex = client.identity.toHexString();
    const best = await waitFor(() => {
      for (const b of client.conn.db.best_scores.iter()) {
        if (b.playerIdentity.toHexString() === idHex && b.bestWeightedScore > 0) return b;
      }
    });

    expect(best.bestWeightedScore).toBeGreaterThan(0);
    expect(best.bestTotalAnswered).toBe(ANSWERS.length + 1);
  });
});
