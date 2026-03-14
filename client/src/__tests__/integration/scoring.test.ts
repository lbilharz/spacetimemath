import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connect, waitFor, disconnect, type ConnectedClient } from '../helpers.js';

// Tier-0 pairs only: a and b both from {1, 2, 5, 10}.
// These are never rejected by SEC-06 for a fresh player (learning_tier = 0).
// 16 ordered pairs total — submitting all of them with correct answers and
// fast response times (< 2 s) triggers the speed bonus and crosses the 0.5
// mastery threshold required by check_and_unlock to advance to tier 1.
const TIER0_PAIRS: { a: number; b: number; responseMs: number }[] = [
  { a: 1, b: 1, responseMs: 800 },
  { a: 1, b: 2, responseMs: 820 },
  { a: 1, b: 5, responseMs: 810 },
  { a: 1, b: 10, responseMs: 830 },
  { a: 2, b: 1, responseMs: 800 },
  { a: 2, b: 2, responseMs: 790 },
  { a: 2, b: 5, responseMs: 850 },
  { a: 2, b: 10, responseMs: 860 },
  { a: 5, b: 1, responseMs: 800 },
  { a: 5, b: 2, responseMs: 820 },
  { a: 5, b: 5, responseMs: 900 },
  { a: 5, b: 10, responseMs: 870 },
  { a: 10, b: 1, responseMs: 800 },
  { a: 10, b: 2, responseMs: 810 },
  { a: 10, b: 5, responseMs: 820 },
  { a: 10, b: 10, responseMs: 900 },
];

/**
 * Issue a problem token then submit the answer in one step.
 * SEC-10 requires a server-issued token; SEC-06 requires the pair to be
 * within the player's current tier.
 */
async function issueAndSubmit(
  client: ConnectedClient,
  sessionId: bigint,
  a: number,
  b: number,
  responseMs: number,
): Promise<void> {
  await client.conn.reducers.issueProblem({ sessionId, a, b });
  const result = await waitFor(() => {
    for (const r of client.conn.db.issued_problem_results.iter()) {
      if (r.owner.toHexString() === client.identity.toHexString()) return r;
    }
  }, 5_000);
  await client.conn.reducers.submitAnswer({
    sessionId,
    a,
    b,
    userAnswer: a * b,
    responseMs,
    problemToken: result.token,
  });
}

describe('class sprint scoring', () => {
  let teacher: ConnectedClient;
  let student: ConnectedClient;
  let classroomId: bigint;

  beforeAll(async () => {
    [teacher, student] = await Promise.all([connect(), connect()]);
    await Promise.all([
      teacher.conn.reducers.register({ username: 'scoring_teacher' }),
      student.conn.reducers.register({ username: 'scoring_student' }),
    ]);

    // Teacher creates classroom
    const teacherHex = teacher.identity.toHexString();
    await teacher.conn.reducers.createClassroom({ name: 'Scoring Test Class' });
    const classroom = await waitFor(() => {
      for (const c of teacher.conn.db.classrooms.iter()) {
        if (c.teacher.toHexString() === teacherHex) return c;
      }
    });
    classroomId = classroom.id;

    // Student joins classroom
    await student.conn.reducers.joinClassroom({ code: classroom.code });
    const studentHex = student.identity.toHexString();
    await waitFor(() => {
      for (const m of student.conn.db.classroom_members.iter()) {
        if (m.classroomId === classroomId && m.playerIdentity.toHexString() === studentHex) return m;
      }
    });
  }, 30_000);

  afterAll(() => {
    disconnect(teacher.conn);
    disconnect(student.conn);
  });

  // SCORE-01: finalize_class_sprint_sessions must call credit_session_to_player
  // so that students who never called endSession still get a BestScore row.
  it('credits BestScore after class sprint ends (student session finalized by server)', async () => {
    const teacherHex = teacher.identity.toHexString();
    const studentHex = student.identity.toHexString();

    // Teacher starts class sprint — server auto-creates sessions for all classroom members
    await teacher.conn.reducers.startClassSprint({ classroomId, isDiagnostic: false });
    const sprint = await waitFor(() => {
      for (const s of teacher.conn.db.class_sprints.iter()) {
        if (s.teacher.toHexString() === teacherHex && s.isActive) return s;
      }
    });

    // Wait for the student's session to appear (created by startClassSprint on the server)
    const session = await waitFor(() => {
      for (const s of student.conn.db.sessions.iter()) {
        if (s.playerIdentity.toHexString() === studentHex && !s.isComplete
            && s.classSprintId === sprint.id) return s;
      }
    }, 10_000);

    // Student submits a few tier-0 answers (SEC-06 safe, with SEC-10 tokens)
    for (const pair of TIER0_PAIRS.slice(0, 4)) {
      await issueAndSubmit(student, session.id, pair.a, pair.b, pair.responseMs);
    }

    // NOTE: student does NOT call endSession.
    // Teacher ends class sprint → server calls finalize_class_sprint_sessions
    // which finalizes the incomplete session and calls credit_session_to_player.
    await teacher.conn.reducers.endClassSprint({ classSprintId: sprint.id });

    // SCORE-01: BestScore row must appear for the student after endClassSprint
    const bestScore = await waitFor(() => {
      for (const b of student.conn.db.best_scores.iter()) {
        if (b.playerIdentity.toHexString() === studentHex) return b;
      }
    }, 10_000);

    expect(bestScore).toBeDefined();
  });

  // SCORE-02: check_and_unlock must be invoked per-student in finalize_class_sprint_sessions
  // so that tier progression can happen via a class sprint (not just solo end_session).
  it('triggers tier unlock after class sprint ends (student session finalized by server)', async () => {
    const teacherHex = teacher.identity.toHexString();
    const studentHex = student.identity.toHexString();

    // Teacher starts a new class sprint
    await teacher.conn.reducers.startClassSprint({ classroomId, isDiagnostic: false });
    const sprint2 = await waitFor(() => {
      for (const s of teacher.conn.db.class_sprints.iter()) {
        if (s.teacher.toHexString() === teacherHex && s.isActive) return s;
      }
    });

    // Wait for the student's session to appear
    const session2 = await waitFor(() => {
      for (const s of student.conn.db.sessions.iter()) {
        if (s.playerIdentity.toHexString() === studentHex && !s.isComplete
            && s.classSprintId === sprint2.id) return s;
      }
    }, 10_000);

    // Student answers ALL 16 tier-0 pairs correctly with response < 2s.
    // This triggers speed_bonus and crosses the 0.5 mastery threshold,
    // causing check_and_unlock to advance learning_tier from 0 → 1.
    for (const pair of TIER0_PAIRS) {
      await issueAndSubmit(student, session2.id, pair.a, pair.b, pair.responseMs);
    }

    // Student does NOT call endSession — finalize_class_sprint_sessions handles it
    await teacher.conn.reducers.endClassSprint({ classSprintId: sprint2.id });

    // SCORE-02: learningTier must advance after endClassSprint triggers tier check
    const player = await waitFor(() => {
      for (const p of student.conn.db.players.iter()) {
        if (p.identity.toHexString() === studentHex && p.learningTier > 0) return p;
      }
    }, 10_000);

    expect(player.learningTier).toBeGreaterThan(0);
  });
});
