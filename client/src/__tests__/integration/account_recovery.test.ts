/**
 * Account recovery integration test scaffold — Phase 5 (ACCT-03, ACCT-04)
 *
 * ACCT-03: restore_account reducer — anonymous caller enters valid recovery code,
 *   server writes token to restore_results private table, client reads and reloads.
 * ACCT-04: get_class_recovery_codes reducer — teacher fetches student recovery codes
 *   into class_recovery_results private table for bulk print download.
 *
 * NOTE: These tests require Plan 02/03 client bindings (restore_results_table.ts,
 * class_recovery_results_table.ts, restore_account_reducer.ts,
 * get_class_recovery_codes_reducer.ts) to be present in module_bindings/.
 * Until those bindings are added, reducers and tables are accessed via (as any) casts —
 * same pattern used in security.test.ts and gdpr.test.ts.
 *
 * KNOWN LIMITATION (SpacetimeDB 2.0.3): Private table rows written by a reducer
 * may not be delivered to the calling client via subscription updates in all cases.
 * Tests that depend on reading restore_results or class_recovery_results are marked
 * it.skip until the server is deployed AND client bindings are confirmed working.
 * The test file must parse and run without crashing. Failures are expected; crashes are not.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connect, waitFor, disconnect, type ConnectedClient } from '../helpers.js';

// ── ACCT-03: restore_account reducer ─────────────────────────────────────────

describe('ACCT-03: restore_account via recovery code', () => {
  let original: ConnectedClient;
  let anon: ConnectedClient;

  beforeAll(async () => {
    original = await connect();
    await original.conn.reducers.register({ username: 'acct_03_owner' });
    await original.conn.reducers.createRecoveryKey({ token: original.token });

    // Wait for recovery code to be available in recovery_code_results
    await (original.conn.reducers as any).getMyRecoveryCode({});
    await new Promise(r => setTimeout(r, 500));

    // Connect anonymous client (no token = fresh identity)
    anon = await connect();
  }, 30_000);

  afterAll(() => {
    disconnect(original.conn);
    disconnect(anon.conn);
  });

  it.skip(
    'ACCT-03: restore_account returns token for anonymous caller with valid code',
    async () => {
      // KNOWN LIMITATION (SpacetimeDB 2.0.3): Private table rows (restore_results)
      // written by the restore_account reducer are not delivered to the calling client
      // via ReducerResult transaction updates. This test will pass once private table
      // row delivery is confirmed working for the owning identity.
      //
      // Expected flow:
      // 1. 'original' registers + creates recovery key → code available in recovery_code_results
      // 2. 'anon' calls restoreAccount({ code }) with the recovery code
      // 3. 'anon' subscription receives restore_results row with token == original.token
      // 4. Client would then write token to localStorage + reload
      const rcRows = [...((original.conn.db as any).recovery_code_results?.iter() ?? [])];
      const recoveryCode: string | undefined = rcRows[0]?.code;

      if (!recoveryCode) {
        // Bindings for recovery_code_results may not yet be available
        expect(recoveryCode).toBeDefined();
        return;
      }

      await (anon.conn.reducers as any).restoreAccount({ code: recoveryCode });

      const result = await waitFor(() => {
        const rows = [...((anon.conn.db as any).restore_results?.iter() ?? [])];
        return rows.find((r: any) =>
          r.caller?.toHexString() === anon.identity.toHexString()
        );
      }, 5_000);

      expect(result).toBeDefined();
      expect(result.token).toBe(original.token);
    }
  );

  it('ACCT-03: restore_account returns error for unknown recovery code', async () => {
    // 'XXXXXXXXXXXX' is 12 chars, uppercase — syntactically valid but unknown.
    // Server should return Err("Recovery code not found").
    await expect(
      (anon.conn.reducers as any).restoreAccount({ code: 'XXXXXXXXXXXX' })
    ).rejects.toThrow();
  });

  it('ACCT-03: restore_account returns error for invalid code length', async () => {
    // Codes shorter or longer than 12 chars should be rejected immediately.
    await expect(
      (anon.conn.reducers as any).restoreAccount({ code: 'TOOSHORT' })
    ).rejects.toThrow();
  });
});

// ── ACCT-04: get_class_recovery_codes reducer ─────────────────────────────────

describe('ACCT-04: get_class_recovery_codes for teacher download', () => {
  let teacher: ConnectedClient;
  let student: ConnectedClient;
  let outsider: ConnectedClient;
  let classroomId: bigint;

  beforeAll(async () => {
    [teacher, student, outsider] = await Promise.all([
      connect(),
      connect(),
      connect(),
    ]);

    await teacher.conn.reducers.register({ username: 'acct_04_teacher' });
    await student.conn.reducers.register({ username: 'acct_04_student' });
    await outsider.conn.reducers.register({ username: 'acct_04_outsider' });

    // Teacher creates a classroom
    await teacher.conn.reducers.createClassroom({ name: 'ACCT04 Class' });

    // Wait for classroom to appear
    const teacherIdHex = teacher.identity.toHexString();
    const classroom = await waitFor(() => {
      for (const c of teacher.conn.db.classrooms.iter()) {
        if (c.teacher.toHexString() === teacherIdHex) return c;
      }
    });
    classroomId = classroom.id;

    // Student creates a recovery key
    await student.conn.reducers.createRecoveryKey({ token: student.token });

    // Give server time to process
    await new Promise(r => setTimeout(r, 500));
  }, 45_000);

  afterAll(() => {
    disconnect(teacher.conn);
    disconnect(student.conn);
    disconnect(outsider.conn);
  });

  it.skip(
    'ACCT-04: get_class_recovery_codes writes result rows for all classroom members',
    async () => {
      // KNOWN LIMITATION (SpacetimeDB 2.0.3): Private table rows
      // (class_recovery_results) may not be delivered via subscription.
      // Re-enable once Plan 02/03 client bindings are added and private
      // table row delivery is confirmed.
      //
      // Expected: after calling getClassRecoveryCodes, teacher's connection
      // receives one class_recovery_results row per student with a recovery key.
      await (teacher.conn.reducers as any).getClassRecoveryCodes({
        classroomId,
      });

      const result = await waitFor(() => {
        const rows = [...((teacher.conn.db as any).class_recovery_results?.iter() ?? [])];
        return rows.find(
          (r: any) =>
            r.teacher_identity?.toHexString() === teacher.identity.toHexString() &&
            r.classroom_id === classroomId
        );
      }, 5_000);

      expect(result).toBeDefined();
      expect(result.username).toBe('acct_04_student');
      expect(typeof result.code).toBe('string');
      expect(result.code).toHaveLength(12);
    }
  );

  it('ACCT-04: non-teacher calling get_class_recovery_codes returns an error', async () => {
    // outsider is not the teacher of classroomId — server should reject.
    await expect(
      (outsider.conn.reducers as any).getClassRecoveryCodes({ classroomId })
    ).rejects.toThrow();
  });

  it.skip(
    'ACCT-04: stale rows from a previous call are replaced (no duplicates)',
    async () => {
      // KNOWN LIMITATION: see above note on private table delivery.
      //
      // Expected: calling getClassRecoveryCodes twice yields the same number
      // of result rows (old rows deleted before new ones inserted).
      await (teacher.conn.reducers as any).getClassRecoveryCodes({ classroomId });
      await new Promise(r => setTimeout(r, 500));

      const countAfterFirst = [
        ...((teacher.conn.db as any).class_recovery_results?.iter() ?? []),
      ].filter(
        (r: any) =>
          r.teacher_identity?.toHexString() === teacher.identity.toHexString()
      ).length;

      await (teacher.conn.reducers as any).getClassRecoveryCodes({ classroomId });
      await new Promise(r => setTimeout(r, 500));

      const countAfterSecond = [
        ...((teacher.conn.db as any).class_recovery_results?.iter() ?? []),
      ].filter(
        (r: any) =>
          r.teacher_identity?.toHexString() === teacher.identity.toHexString()
      ).length;

      expect(countAfterSecond).toBe(countAfterFirst);
    }
  );
});
