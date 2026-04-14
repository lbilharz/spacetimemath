import { test, expect } from '@playwright/test';
import {
  connectAsBrowserSession,
  cleanupTestUser,
  waitFor,
  type StdbTestClient,
} from './helpers/stdb-test-client';
import { dismissOnboarding, solveOneProblem } from './helpers/ui';
import { PAGE_PATH } from '../../navigation';

test.describe('Solo Sprint Full Loop', () => {
  let stdbConn: StdbTestClient | undefined;

  test.afterEach(async () => {
    await cleanupTestUser(stdbConn);
    stdbConn = undefined;
  });

  test('register → sprint → results updates Player, Session, BestScore', async ({ page }) => {
    test.setTimeout(180_000);

    const testUsername = `E2E_${Date.now()}`;

    // 1. Register via UI
    await page.goto('/');
    await page.getByTestId('username-input').fill(testUsername);
    await page.getByTestId('register-submit').click();

    // 2. Attach Node-side STDB client to the same identity the browser just got
    stdbConn = await connectAsBrowserSession(page);
    const idHex = stdbConn.identity.toHexString();

    // 3. Verify backend: Player row created with the chosen username
    const player = await waitFor(() => {
      for (const p of stdbConn!.conn.db.players.iter()) {
        if (p.identity.toHexString() === idHex) return p;
      }
    }, 10_000);
    expect(player.username).toBe(testUsername);

    // 4. Skip onboarding, start sprint.
    // The last onboarding card's button is "Start Sprint" (handleDone), so the
    // overlay may auto-launch the sprint. Only click the lobby button if we're
    // still on the lobby afterwards.
    await dismissOnboarding(page);
    const alreadySprinting = await page
      .waitForURL(`**${PAGE_PATH.sprint!}`, { timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (!alreadySprinting) {
      await page.getByTestId('start-sprint-button').click();
    }
    await page.getByTestId('current-problem').waitFor({ timeout: 15_000 });

    // 5. Solve problems until the 60-second timer expires and the browser
    // navigates to /results. SprintPage only ends on its local timer — there
    // is no way to skip the wait without touching production code. 180s
    // timeout above gives ample headroom (60s sprint + ~30s setup/results).
    let solved = 0;
    while (await solveOneProblem(page)) {
      solved++;
      if (solved > 100) throw new Error('Sprint did not end after 100 problems');
    }
    expect(solved).toBeGreaterThan(0);
    // Make sure we reached results (tier-unlock overlay is rendered ON /results)
    await page.waitForURL(`**${PAGE_PATH.results!}`, { timeout: 15_000 });

    // 6. Verify backend state on completion. There may be more than one
    // session row for this identity (the onboarding "Start Sprint" button can
    // race with a defensive lobby-button click). Take the most recent
    // completed session with actual answers.
    const session = await waitFor(() => {
      const mine = [...stdbConn!.conn.db.my_sessions.iter()]
        .filter(s => s.isComplete && s.playerIdentity.toHexString() === idHex)
        .sort((a, b) => Number(b.id - a.id));
      return mine.find(s => s.totalAnswered > 0) ?? mine[0];
    }, 10_000);
    expect(session.totalAnswered).toBeGreaterThan(0);

    const best = await waitFor(() => {
      for (const b of stdbConn!.conn.db.best_scores.iter()) {
        if (b.playerIdentity.toHexString() === idHex) return b;
      }
    }, 10_000);
    expect(best.username).toBe(testUsername); // denormalization contract
    expect(best.bestWeightedScore).toBeGreaterThanOrEqual(session.weightedScore);
  });
});
