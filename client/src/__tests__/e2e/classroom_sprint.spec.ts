/**
 * E2E: Classroom group sprint lifecycle
 *
 * Teacher creates a classroom → student joins via code → teacher starts sprint
 * (Training mode) → both play → teacher ends sprint → ClassSprint.isActive flips false.
 *
 * Uses two isolated browser contexts so each player has separate credentials.
 */
import { test, expect, type Browser } from '@playwright/test';
import {
  connectAsBrowserSession,
  cleanupTestUser,
  waitFor,
  type StdbTestClient,
} from './helpers/stdb-test-client';
import { dismissOnboarding, solveOneProblem } from './helpers/ui';
import {
  openAndRegisterSecondPlayer,
  teardownSecondPlayer,
  type SecondPlayer,
} from './helpers/two-context';

test.describe('Classroom Group Sprint', () => {
  let teacherStdb: StdbTestClient | undefined;
  let student: SecondPlayer | undefined;
  let browser: Browser;

  test.beforeEach(async ({ browser: b }) => { browser = b; });

  test.afterEach(async () => {
    await cleanupTestUser(teacherStdb);
    teacherStdb = undefined;
    await teardownSecondPlayer(student);
    student = undefined;
  });

  test('teacher creates classroom → student joins → sprint runs → ends with session rows', async ({ page }) => {
    test.setTimeout(180_000);

    const teacherName = `E2E_TCH_${Date.now()}`;
    const studentName = `E2E_STU_${Date.now() + 1}`;
    const className   = `E2E Class ${Date.now()}`;

    // ── Teacher: register via UI (as Solo), create classroom Node-side ───
    // createClassroom has no server-side playerType guard — the "Teacher only"
    // restriction is purely in the ClassroomsPage UI. ClassroomPage derives
    // isTeacher from classroom.teacher === myIdentity, so the start/end sprint
    // buttons still appear once we're inside the classroom.
    await page.goto('/');
    await page.getByTestId('username-input').fill(teacherName);
    await page.getByTestId('register-submit').click();
    teacherStdb = await connectAsBrowserSession(page);
    const _teacherHex = teacherStdb.identity.toHexString();

    await dismissOnboarding(page);

    // Create classroom via Node STDB (bypasses UI playerType gate)
    await teacherStdb.conn.reducers.createClassroom({ name: className });

    // Wait for classroom to appear on server + get the join code
    const classroom = await waitFor(() => {
      for (const c of teacherStdb!.conn.db.my_classrooms.iter()) {
        if ((c as any).name === className) return c;
      }
    }, 10_000);
    const joinCode = (classroom as any).code as string;
    expect(joinCode).toMatch(/^[A-Z0-9]{6}$/);

    // ── Student: register + join classroom ───────────────────────────────
    student = await openAndRegisterSecondPlayer(browser, studentName);
    const _studentHex = student.stdb!.identity.toHexString();

    await dismissOnboarding(student.page);
    await student.page.goto('/classrooms');

    await student.page.getByTestId('show-join-button').click();
    await student.page.getByTestId('classroom-join-input').fill(joinCode);
    await student.page.getByTestId('classroom-join-submit').click();

    // Verify student's membership on server (bigint comparison via toString)
    await waitFor(() => {
      for (const m of student!.stdb!.conn.db.my_classroom_members.iter()) {
        if (String((m as any).classroomId) === String((classroom as any).id)) return m;
      }
    }, 10_000);

    // ── Teacher: navigate into classroom + start sprint ───────────────────
    // Navigate to classrooms page and click the classroom row
    await page.goto('/classrooms');
    await page.locator('button').filter({ hasText: className }).click();
    await page.getByTestId('teacher-start-sprint-button').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByTestId('teacher-start-sprint-button').click();

    // Sprint type modal: pick Training (isDiagnostic=false)
    await page.getByTestId('start-sprint-training-button').click();

    // Wait for ClassSprint to become active on server
    const classSprint = await waitFor(() => {
      for (const cs of teacherStdb!.conn.db.class_sprints.iter()) {
        if (
          String((cs as any).classroomId) === String((classroom as any).id) &&
          (cs as any).isActive
        ) return cs;
      }
    }, 15_000);
    expect((classSprint as any).isActive).toBe(true);

    // ── Teacher: ClassroomLiveSprintView renders INLINE (URL stays at /classroom/…)
    // Wait for the end-sprint button to appear — that means the live view is mounted.
    await page.getByTestId('teacher-end-sprint-button').waitFor({ state: 'visible', timeout: 15_000 });

    // ── Student: App.tsx detects the active ClassSprint and shows a 1.5s alert,
    // then calls navigate('sprint') → URL becomes /sprint.
    await student.page.waitForURL('**/sprint', { timeout: 20_000 });

    // Student solves a few problems (teacher observes, does not solve)
    for (let i = 0; i < 5; i++) {
      const done = await solveOneProblem(student.page);
      if (!done) break;
    }

    // ── Teacher: end the sprint ───────────────────────────────────────────
    await page.getByTestId('teacher-end-sprint-button').click();

    // Wait for sprint to become inactive on server
    await waitFor(() => {
      for (const cs of teacherStdb!.conn.db.class_sprints.iter()) {
        if (
          String((cs as any).id) === String((classSprint as any).id) &&
          !(cs as any).isActive
        ) return cs;
      }
    }, 20_000);

    // Verify at least one classroom session was recorded
    const classSessions = [...teacherStdb!.conn.db.my_classroom_sessions.iter()];
    expect(classSessions.length).toBeGreaterThan(0);
  });
});
