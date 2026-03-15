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
 * Normal sprint path: call nextProblem and return the server-delivered
 * (a, b, token) from next_problem_results.
 */
async function getNextProblemToken(
  client: ConnectedClient,
  sessionId: bigint,
): Promise<{ a: number; b: number; token: string }> {
  // Capture current token to detect when a fresh result arrives
  let before: string | undefined;
  for (const r of (client.conn.db as any).next_problem_results.iter()) {
    if (r.owner.toHexString() === client.identity.toHexString()) {
      before = r.token;
      break;
    }
  }

  await client.conn.reducers.nextProblem({ sessionId });

  const result = await waitFor(() => {
    for (const r of (client.conn.db as any).next_problem_results.iter()) {
      if (r.owner.toHexString() === client.identity.toHexString()) {
        if (r.token !== before) return r; // fresh result
      }
    }
  }, 5_000);
  return { a: result.a, b: result.b, token: result.token };
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
    const idHex = client.identity.toHexString();
    const countBefore = [...client.conn.db.answers.iter()].filter(
      a => a.playerIdentity.toHexString() === idHex
    ).length;

    // Normal sprint path: let the server pick 4 problems via nextProblem
    for (let i = 0; i < ANSWERS.length; i++) {
      const { a, b, token } = await getNextProblemToken(client, sessionId);
      await client.conn.reducers.submitAnswer({
        sessionId,
        a,
        b,
        userAnswer: a * b, // always correct
        responseMs: 800,
        problemToken: token,
      });
    }

    // Wait until all 4 answers are recorded
    const answers = await waitFor(() => {
      const all = [...client.conn.db.answers.iter()].filter(
        a => a.playerIdentity.toHexString() === idHex
      );
      return all.length >= countBefore + ANSWERS.length ? all : undefined;
    });

    const newAnswers = answers.slice(countBefore);
    const correct = newAnswers.filter(a => a.isCorrect);
    expect(correct).toHaveLength(ANSWERS.length); // all 4 are correct
  });

  it('wrong answer is recorded as isCorrect = false', async () => {
    const idHex = client.identity.toHexString();
    // Normal sprint path: get a server-picked pair and submit the wrong answer
    const { a, b, token } = await getNextProblemToken(client, sessionId);
    const wrongAnswer = (a * b) + 1; // definitely wrong
    await client.conn.reducers.submitAnswer({ sessionId, a, b, userAnswer: wrongAnswer, responseMs: 1000, problemToken: token });

    const wrong = await waitFor(() => {
      for (const ans of client.conn.db.answers.iter()) {
        if (ans.playerIdentity.toHexString() === idHex && !ans.isCorrect) return ans;
      }
    });

    expect(wrong.isCorrect).toBe(false);
    expect(wrong.userAnswer).toBe(wrongAnswer);
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
