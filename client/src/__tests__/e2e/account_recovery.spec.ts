/**
 * E2E: Account recovery via 12-digit code
 *
 * 1. Register a new player via UI.
 * 2. Create a recovery key (Node-side reducer call — mirrors the /account UI).
 * 3. Fetch the 12-digit code via get_my_recovery_code → my_recovery_code_results.
 * 4. "Log out" by clearing localStorage and reloading.
 * 5. Enter the restore flow in the UI, type the code, submit.
 * 6. Assert the page reloads as the original player (same username).
 */
import { test, expect } from '@playwright/test';
import {
  connectAsBrowserSession,
  cleanupTestUser,
  waitFor,
  type StdbTestClient,
} from './helpers/stdb-test-client';
import { dismissOnboarding } from './helpers/ui';

test.describe('Account Recovery via 12-Digit Code', () => {
  let stdbConn: StdbTestClient | undefined;

  test.afterEach(async () => {
    await cleanupTestUser(stdbConn);
    stdbConn = undefined;
  });

  test('register → generate recovery code → log out → restore → same player', async ({ page }) => {
    test.setTimeout(90_000);

    const username = `E2E_REC_${Date.now()}`;

    // 1. Register via UI
    await page.goto('/');
    await page.getByTestId('username-input').fill(username);
    await page.getByTestId('register-submit').click();
    stdbConn = await connectAsBrowserSession(page);

    await dismissOnboarding(page);

    // 2. Create recovery key (uses the player's own STDB auth token as the key material)
    await stdbConn.conn.reducers.createRecoveryKey({ token: stdbConn.token });

    // 3. Request the 12-digit recovery code from the server
    await (stdbConn.conn.reducers as any).getMyRecoveryCode({});

    const codeResult = await waitFor(() => {
      for (const r of stdbConn!.conn.db.my_recovery_code_results.iter()) {
        if (r.code && r.code.length === 12) return r;
      }
    }, 10_000);
    const recoveryCode = codeResult.code as string;
    expect(recoveryCode).toMatch(/^[A-Z0-9]{12}$/);

    // 4. "Log out": clear credentials from localStorage and reload
    await page.evaluate(() => localStorage.removeItem('spacetimemath_credentials'));
    await page.goto('/');

    // Should land on the register page (no saved token)
    await page.getByTestId('username-input').waitFor({ state: 'visible', timeout: 10_000 });

    // 5. Navigate to restore flow
    await page.getByTestId('restore-toggle').click();
    await page.getByTestId('restore-mode-code').click();

    const codeInput = page.getByTestId('restore-code-input');
    await codeInput.waitFor({ state: 'visible', timeout: 5_000 });
    await codeInput.fill(recoveryCode);

    // Record anon identity so we can detect when localStorage swaps to the
    // original after the restore-triggered page reload.
    const anonIdentity = await page.evaluate(() => {
      const raw = localStorage.getItem('spacetimemath_credentials');
      return raw ? JSON.parse(raw).identity as string : null;
    });

    await page.getByTestId('restore-code-submit').click();

    // 6. Wait for restore to complete: localStorage.identity changes from anon
    //    to the original player's identity, then the app does window.location.reload().
    await page.waitForFunction(
      (anonId: string) => {
        const raw = localStorage.getItem('spacetimemath_credentials');
        if (!raw) return false;
        const creds = JSON.parse(raw);
        return creds.identity && creds.identity !== anonId;
      },
      anonIdentity,
      { timeout: 30_000 },
    );

    // Attach a fresh STDB connection to verify the restored identity sees
    // the same player row
    const restoredConn = await connectAsBrowserSession(page);
    try {
      const player = await waitFor(() => {
        for (const p of restoredConn.conn.db.players.iter()) {
          if (p.identity.toHexString() === restoredConn.identity.toHexString()) return p;
        }
      }, 10_000);
      expect(player.username).toBe(username);
    } finally {
      restoredConn.conn.disconnect();
    }
  });
});
