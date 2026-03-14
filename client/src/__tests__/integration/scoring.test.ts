import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connect, waitFor, disconnect, type ConnectedClient } from '../helpers.js';

const ANSWERS = [
  { a: 2, b: 3, userAnswer: 6,  responseMs: 800 },
  { a: 2, b: 4, userAnswer: 8,  responseMs: 750 },
  { a: 2, b: 5, userAnswer: 10, responseMs: 900 },
  { a: 2, b: 6, userAnswer: 12, responseMs: 850 },
];

describe('class sprint scoring', () => {
  let teacher: ConnectedClient;
  let student: ConnectedClient;
  let classroomId: bigint;
  let classSprintId: bigint;

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

  it('credits BestScore after class sprint ends', async () => {
    const teacherHex = teacher.identity.toHexString();
    const studentHex = student.identity.toHexString();

    // Teacher starts class sprint
    await teacher.conn.reducers.startClassSprint({ classroomId, isDiagnostic: false });
    const sprint = await waitFor(() => {
      for (const s of teacher.conn.db.class_sprints.iter()) {
        if (s.teacher.toHexString() === teacherHex && s.isActive) return s;
      }
    });
    classSprintId = sprint.id;

    // Student joins session for this class sprint
    await student.conn.reducers.startSession({});
    const session = await waitFor(() => {
      for (const s of student.conn.db.sessions.iter()) {
        if (s.playerIdentity.toHexString() === studentHex && !s.isComplete) return s;
      }
    });

    // Student submits ×2 answers (safe tier-0 answers, SEC-06 won't reject)
    for (const ans of ANSWERS) {
      await student.conn.reducers.submitAnswer({ sessionId: session.id, ...ans });
    }

    // Student ends session
    await student.conn.reducers.endSession({ sessionId: session.id });

    // Teacher ends class sprint
    await teacher.conn.reducers.endClassSprint({ classSprintId });

    // SCORE-01: after endClassSprint the student should have a BestScore row
    // This will FAIL (RED) until the server end_class_sprint reducer credits BestScore
    const bestScore = await waitFor(() => {
      for (const b of student.conn.db.best_scores.iter()) {
        if (b.playerIdentity.toHexString() === studentHex) return b;
      }
    }, 10_000);

    expect(bestScore).toBeDefined();
  });

  it('triggers tier unlock after class sprint ends', async () => {
    const teacherHex = teacher.identity.toHexString();
    const studentHex = student.identity.toHexString();

    // Teacher starts a new class sprint
    await teacher.conn.reducers.startClassSprint({ classroomId, isDiagnostic: false });
    const sprint2 = await waitFor(() => {
      for (const s of teacher.conn.db.class_sprints.iter()) {
        if (s.teacher.toHexString() === teacherHex && s.isActive) return s;
      }
    });

    // Student starts session for this sprint
    await student.conn.reducers.startSession({});
    const session2 = await waitFor(() => {
      for (const s of student.conn.db.sessions.iter()) {
        if (s.playerIdentity.toHexString() === studentHex && !s.isComplete) return s;
      }
    });

    // Student submits enough ×2 answers to qualify for tier unlock
    for (const ans of ANSWERS) {
      await student.conn.reducers.submitAnswer({ sessionId: session2.id, ...ans });
    }

    await student.conn.reducers.endSession({ sessionId: session2.id });
    await teacher.conn.reducers.endClassSprint({ classSprintId: sprint2.id });

    // SCORE-02: after endClassSprint the student's learningTier should advance
    // This will FAIL (RED) until the server end_class_sprint reducer runs tier unlock logic
    const player = await waitFor(() => {
      for (const p of student.conn.db.players.iter()) {
        if (p.identity.toHexString() === studentHex && p.learningTier > 0) return p;
      }
    }, 10_000);

    expect(player.learningTier).toBeGreaterThan(0);
  });
});
