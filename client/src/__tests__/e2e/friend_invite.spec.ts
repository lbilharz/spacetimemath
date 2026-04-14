/**
 * E2E: Friend invite flow
 *
 * User A creates a friend invite → gets an 8-digit code formatted as 12-34-56-78.
 * User B enters that code → both see a mutual Friendship row on the server.
 */
import { test, expect, type Browser } from '@playwright/test';
import {
  connectAsBrowserSession,
  cleanupTestUser,
  waitFor,
  type StdbTestClient,
} from './helpers/stdb-test-client';
import { dismissOnboarding } from './helpers/ui';
import {
  openAndRegisterSecondPlayer,
  teardownSecondPlayer,
  type SecondPlayer,
} from './helpers/two-context';

test.describe('Friend Invite Flow', () => {
  let stdbA: StdbTestClient | undefined;
  let playerB: SecondPlayer | undefined;
  let browser: Browser;

  test.beforeEach(async ({ browser: b }) => { browser = b; });

  test.afterEach(async () => {
    await cleanupTestUser(stdbA);
    stdbA = undefined;
    await teardownSecondPlayer(playerB);
    playerB = undefined;
  });

  test('userA creates invite → userB accepts → mutual Friendship created', async ({ page }) => {
    test.setTimeout(90_000);

    const usernameA = `E2E_A_${Date.now()}`;
    const usernameB = `E2E_B_${Date.now() + 1}`;

    // ── User A: register + navigate to Friends ───────────────────────────
    await page.goto('/');
    await page.getByTestId('username-input').fill(usernameA);
    await page.getByTestId('register-submit').click();
    stdbA = await connectAsBrowserSession(page);
    const idAHex = stdbA.identity.toHexString();

    await dismissOnboarding(page);
    await page.goto('/friends');

    // Create invite
    await page.getByTestId('create-invite-button').click();

    // Wait for invite code to appear in the card
    const codeDisplay = page.getByTestId('invite-code-display');
    await codeDisplay.waitFor({ state: 'visible', timeout: 10_000 });

    // Extract the raw 8-digit token (strip dashes from display format XX-XX-XX-XX)
    const displayCode = await codeDisplay.textContent();
    expect(displayCode).toMatch(/^\d{2}-\d{2}-\d{2}-\d{2}$/);
    const rawToken = displayCode!.replace(/-/g, '');

    // Verify invite row on server
    const invite = await waitFor(() => {
      for (const inv of stdbA!.conn.db.my_friend_invites.iter()) {
        if (inv.creatorIdentity?.toHexString() === idAHex) return inv;
      }
    }, 10_000);
    expect(invite.token).toBe(rawToken);

    // ── User B: register + navigate to Friends ───────────────────────────
    playerB = await openAndRegisterSecondPlayer(browser, usernameB);
    const idBHex = playerB.stdb!.identity.toHexString();

    await dismissOnboarding(playerB.page);
    await playerB.page.goto('/friends');

    // Accept invite: click "Have a code?" then enter token
    await playerB.page.getByTestId('have-code-button').click();

    const input = playerB.page.getByTestId('friend-invite-input');
    await input.waitFor({ state: 'visible', timeout: 5_000 });

    // The input auto-formats: type the raw digits, let the onChange handler add dashes
    await input.fill(rawToken);

    await playerB.page.getByTestId('friend-invite-submit').click();

    // ── Assert: both sides see a mutual Friendship ───────────────────────
    // my_friendships rows have initiatorIdentity + recipientIdentity; either
    // field may carry the "other" person depending on who initiated.
    const isFriendWith = (rows: Iterable<any>, targetHex: string) => {
      for (const f of rows) {
        if (
          f.initiatorIdentity?.toHexString() === targetHex ||
          f.recipientIdentity?.toHexString() === targetHex
        ) return f;
      }
    };

    // User B sees A in their friendships
    await waitFor(() =>
      isFriendWith(playerB!.stdb!.conn.db.my_friendships.iter(), idAHex),
    15_000);

    // User A sees B in their friendships
    await waitFor(() =>
      isFriendWith(stdbA!.conn.db.my_friendships.iter(), idBHex),
    15_000);
  });
});
