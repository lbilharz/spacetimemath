import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connect, waitFor, disconnect, type ConnectedClient } from '../helpers.js';

describe('classroom lifecycle', () => {
  let teacher: ConnectedClient;
  let student: ConnectedClient;
  let classroomId: bigint;
  let classroomCode: string;

  beforeAll(async () => {
    [teacher, student] = await Promise.all([connect(), connect()]);
    await Promise.all([
      teacher.conn.reducers.register({ username: 'teacher_a', playerType: { tag: 'Solo' }, email: undefined }),
      student.conn.reducers.register({ username: 'student_a', playerType: { tag: 'Solo' }, email: undefined }),
    ]);
  }, 20_000);

  afterAll(() => {
    disconnect(teacher.conn);
    disconnect(student.conn);
  });

  it('teacher can create a classroom', async () => {
    const teacherHex = teacher.identity.toHexString();
    await teacher.conn.reducers.createClassroom({ name: 'Mathe 4b' });

    const classroom = await waitFor(() => {
      for (const c of teacher.conn.db.classrooms.iter()) {
        if (c.teacher.toHexString() === teacherHex) return c;
      }
    });

    classroomId   = classroom.id;
    classroomCode = classroom.code;

    expect(classroom.name).toBe('Mathe 4b');
    expect(classroomCode).toHaveLength(6);
    expect(classroomCode).toMatch(/^[A-Z0-9]+$/);
  });

  it('teacher is automatically a member after creating', async () => {
    const teacherHex = teacher.identity.toHexString();
    const member = await waitFor(() => {
      for (const m of teacher.conn.db.classroom_members.iter()) {
        if (
          m.classroomId === classroomId &&
          m.playerIdentity.toHexString() === teacherHex
        ) return m;
      }
    });

    expect(member.hidden).toBe(false);
  });

  it('student can join by 6-char code', async () => {
    const studentHex = student.identity.toHexString();
    await student.conn.reducers.joinClassroom({ code: classroomCode });

    const member = await waitFor(() => {
      for (const m of student.conn.db.classroom_members.iter()) {
        if (
          m.classroomId === classroomId &&
          m.playerIdentity.toHexString() === studentHex
        ) return m;
      }
    });

    expect(member.classroomId).toBe(classroomId);
    expect(member.hidden).toBe(false);
  });

  it('joining twice does not create a duplicate member row', async () => {
    const studentHex = student.identity.toHexString();
    // joinClassroom is idempotent on the server — second call should be a no-op
    await student.conn.reducers.joinClassroom({ code: classroomCode });

    // Wait a moment for any potential duplicate to arrive
    await new Promise(r => setTimeout(r, 300));

    const memberships = [...student.conn.db.classroom_members.iter()].filter(
      m =>
        m.classroomId === classroomId &&
        m.playerIdentity.toHexString() === studentHex
    );

    expect(memberships).toHaveLength(1);
  });

  it('classroom is visible to the student after joining', async () => {
    const classroom = await waitFor(() => {
      for (const c of student.conn.db.classrooms.iter()) {
        if (c.id === classroomId) return c;
      }
    });

    expect(classroom.name).toBe('Mathe 4b');
  });
});

// SEC-01/02: transfer_codes and recovery_keys are private tables — codegen skips
// them, so client.conn.db.transfer_codes/.recovery_keys are undefined at runtime.
// These suites cannot verify table contents without a server-side query reducer.
// Covered functionally by account_recovery.test.ts (ACCT-03/04).
describe.skip('transfer code', () => {
  let client: ConnectedClient;

  beforeAll(async () => {
    client = await connect();
    await client.conn.reducers.register({ username: 'transfer_user', playerType: { tag: 'Solo' }, email: undefined });
  }, 15_000);

  afterAll(() => disconnect(client.conn));

  it('createRecoveryKey creates a 6-char code', async () => {
    const idHex = client.identity.toHexString();
    await client.conn.reducers.createRecoveryKey({ token: 'dummy-token-abc' });

    const code = await waitFor(() => {
      for (const tc of client.conn.db.transfer_codes.iter()) {
        if (tc.owner.toHexString() === idHex) return tc;
      }
    });

    expect(code.code).toHaveLength(6);
    expect(code.code).toMatch(/^[A-Z0-9]+$/);
  });

  it('restoreAccount removes the code from the table', async () => {
    const idHex = client.identity.toHexString();
    const tc = [...client.conn.db.transfer_codes.iter()].find(
      c => c.owner.toHexString() === idHex
    )!;

    await client.conn.reducers.restoreAccount({ code: tc.code });

    // After use the row should be gone
    const gone = await waitFor(() => {
      const still = [...client.conn.db.transfer_codes.iter()].find(
        c => c.code === tc.code
      );
      return still === undefined ? true : undefined;
    });

    expect(gone).toBe(true);
  });
});

describe.skip('recovery key', () => {
  let client: ConnectedClient;

  beforeAll(async () => {
    client = await connect();
    await client.conn.reducers.register({ username: 'recovery_user', playerType: { tag: 'Solo' }, email: undefined });
  }, 15_000);

  afterAll(() => disconnect(client.conn));

  it('createRecoveryKey creates a 12-char key', async () => {
    const idHex = client.identity.toHexString();
    await client.conn.reducers.createRecoveryKey({ token: 'dummy-recovery-token' });

    const key = await waitFor(() => {
      for (const rk of client.conn.db.recovery_keys.iter()) {
        if (rk.owner.toHexString() === idHex) return rk;
      }
    });

    expect(key.code).toHaveLength(12);
    expect(key.code).toMatch(/^[A-Z0-9]+$/);
  });

  it('calling createRecoveryKey again is a no-op (idempotent)', async () => {
    const idHex = client.identity.toHexString();
    const before = [...client.conn.db.recovery_keys.iter()].find(
      rk => rk.owner.toHexString() === idHex
    )!;

    await client.conn.reducers.createRecoveryKey({ token: 'another-token' });
    await new Promise(r => setTimeout(r, 300));

    const keys = [...client.conn.db.recovery_keys.iter()].filter(
      rk => rk.owner.toHexString() === idHex
    );

    expect(keys).toHaveLength(1);
    expect(keys[0].code).toBe(before.code); // same code, not replaced
  });
});
