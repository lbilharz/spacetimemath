/**
 * Deep Link Integration Tests
 *
 * Verifies the backend reducers powering the /friend/[token] and ?join=[code]
 * URL flows:
 *
 *   1. Friend invite: create → accept via token → friendship created
 *   2. Classroom join: create classroom → join via code → membership created
 *   3. Invalid/expired tokens are rejected gracefully
 *
 * The actual URL routing (localStorage bridging, registration page) is a
 * client-side concern. These tests validate the server-side contract those
 * flows depend on.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { connect, waitFor, disconnect, type ConnectedClient } from '../helpers.js';

describe('Deep Link Flows', () => {
  const clients: ConnectedClient[] = [];

  const createClient = async (username: string) => {
    const client = await connect();
    await client.conn.reducers.register({
      username,
      playerType: { tag: 'Solo' },
      email: undefined,
    });
    clients.push(client);
    return client;
  };

  afterAll(() => clients.forEach(c => disconnect(c.conn)));

  // ─── Friend invite via token (/friend/[token]) ─────────────────────────

  describe('Friend Invite Deep Link', () => {
    it('creates invite, accepts via token, and establishes friendship', async () => {
      const alice = await createClient(`dl_alice_${Date.now()}`);
      const bob = await createClient(`dl_bob_${Date.now()}`);

      // Alice creates a friend invite
      await alice.conn.reducers.createFriendInvite();

      // Wait for the invite to appear
      const invite = await waitFor(() => {
        for (const i of alice.conn.db.my_friend_invites.iter()) {
          if (i.creatorIdentity.toHexString() === alice.identity.toHexString()) {
            return i;
          }
        }
        return undefined;
      });

      expect(invite.token).toBeTruthy();
      expect(invite.token.length).toBe(8);
      // Token should be pure numeric
      expect(invite.token).toMatch(/^[0-9]+$/);

      // Bob accepts the invite using the raw token
      // (this is what App.tsx does after extracting from /friend/[token])
      await bob.conn.reducers.acceptFriendInvite({ token: invite.token });

      // Verify friendship visible to both sides
      const aliceHex = alice.identity.toHexString();
      const bobHex = bob.identity.toHexString();

      const hasFriendship = (client: ConnectedClient) =>
        waitFor(() => {
          for (const f of client.conn.db.my_friendships.iter()) {
            const a = f.initiatorIdentity.toHexString();
            const b = f.recipientIdentity.toHexString();
            if ((a === aliceHex && b === bobHex) || (a === bobHex && b === aliceHex)) {
              return f;
            }
          }
          return undefined;
        });

      const [aliceF, bobF] = await Promise.all([hasFriendship(alice), hasFriendship(bob)]);
      expect(aliceF).toBeDefined();
      expect(bobF).toBeDefined();
    }, 15_000);

    it('rejects an invalid token', async () => {
      const user = await createClient(`dl_invalid_${Date.now()}`);
      await expect(
        user.conn.reducers.acceptFriendInvite({ token: '00000000' }),
      ).rejects.toThrow();
    }, 10_000);

    it('invite link is shareable — multiple users can accept the same token', async () => {
      const creator = await createClient(`dl_creator_${Date.now()}`);
      const first = await createClient(`dl_first_${Date.now()}`);
      const second = await createClient(`dl_second_${Date.now()}`);

      await creator.conn.reducers.createFriendInvite();
      const invite = await waitFor(() => {
        for (const i of creator.conn.db.my_friend_invites.iter()) {
          if (i.creatorIdentity.toHexString() === creator.identity.toHexString()) return i;
        }
        return undefined;
      });

      const creatorHex = creator.identity.toHexString();

      // First user accepts
      await first.conn.reducers.acceptFriendInvite({ token: invite.token });
      await waitFor(() => {
        for (const f of first.conn.db.my_friendships.iter()) {
          if (f.initiatorIdentity.toHexString() === creatorHex ||
              f.recipientIdentity.toHexString() === creatorHex) return f;
        }
        return undefined;
      });

      // Second user also accepts the same shared invite link
      await second.conn.reducers.acceptFriendInvite({ token: invite.token });
      const secondFriendship = await waitFor(() => {
        for (const f of second.conn.db.my_friendships.iter()) {
          if (f.initiatorIdentity.toHexString() === creatorHex ||
              f.recipientIdentity.toHexString() === creatorHex) return f;
        }
        return undefined;
      });

      // Both friendships exist — invite links work like shareable invites
      expect(secondFriendship).toBeDefined();
    }, 15_000);
  });

  // ─── Classroom join via code (?join=[code]) ─────────────────────────────

  describe('Classroom Join Deep Link', () => {
    it('creates classroom and joins via 6-digit code', async () => {
      const teacher = await createClient(`dl_teach_${Date.now()}`);

      await teacher.conn.reducers.createClassroom({ name: `DL Test ${Date.now()}` });

      const classroom = await waitFor(() => {
        for (const c of teacher.conn.db.my_classrooms.iter()) {
          if (c.teacher?.toHexString() === teacher.identity.toHexString()) return c;
        }
        return undefined;
      });

      expect(classroom.code).toBeTruthy();
      expect(classroom.code.length).toBe(6);
      // New codes should be pure numeric
      expect(classroom.code).toMatch(/^[0-9]+$/);

      // Student joins via code
      // (this is what LobbyPage does after extracting from ?join=[code])
      const student = await createClient(`dl_stud_${Date.now()}`);
      await student.conn.reducers.joinClassroom({ code: classroom.code });

      // Verify membership
      const membership = await waitFor(() => {
        for (const m of student.conn.db.my_classroom_members.iter()) {
          if (
            m.classroomId === classroom.id &&
            m.playerIdentity.toHexString() === student.identity.toHexString()
          ) return m;
        }
        return undefined;
      });

      expect(membership).toBeDefined();

      // Verify classroom is now visible to student
      const studentClassroom = await waitFor(() => {
        for (const c of student.conn.db.my_classrooms.iter()) {
          if (c.id === classroom.id) return c;
        }
        return undefined;
      });
      expect(studentClassroom.name).toBe(classroom.name);
    }, 20_000);

    it('rejects an invalid classroom code', async () => {
      const user = await createClient(`dl_noclass_${Date.now()}`);
      await expect(
        user.conn.reducers.joinClassroom({ code: '999999' }),
      ).rejects.toThrow();
    }, 10_000);

    it('prevents double-joining the same classroom', async () => {
      const teacher = await createClient(`dl_teach2_${Date.now()}`);
      await teacher.conn.reducers.createClassroom({ name: `DL Dupe ${Date.now()}` });

      const classroom = await waitFor(() => {
        for (const c of teacher.conn.db.my_classrooms.iter()) {
          if (c.teacher?.toHexString() === teacher.identity.toHexString()) return c;
        }
        return undefined;
      });

      const student = await createClient(`dl_dupe_${Date.now()}`);
      await student.conn.reducers.joinClassroom({ code: classroom.code });

      await waitFor(() => {
        for (const m of student.conn.db.my_classroom_members.iter()) {
          if (m.classroomId === classroom.id) return m;
        }
        return undefined;
      });

      // Second join should be a no-op or error, not create duplicate membership
      await student.conn.reducers.joinClassroom({ code: classroom.code });

      // Allow a beat for any duplicate to arrive
      await new Promise(r => setTimeout(r, 500));

      let count = 0;
      for (const m of student.conn.db.my_classroom_members.iter()) {
        if (
          m.classroomId === classroom.id &&
          m.playerIdentity.toHexString() === student.identity.toHexString()
        ) count++;
      }
      expect(count).toBe(1);
    }, 20_000);
  });
});
