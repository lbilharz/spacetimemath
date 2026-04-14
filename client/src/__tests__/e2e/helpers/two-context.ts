/**
 * Multi-context helpers for Playwright E2E tests that need two independent
 * users in the same browser session (e.g. friend invite, classroom sprint).
 *
 * Each context gets its own isolated localStorage so STDB credential storage
 * doesn't bleed between users.
 */
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { connectAsBrowserSession, cleanupTestUser, type StdbTestClient } from './stdb-test-client';

export interface SecondPlayer {
  context: BrowserContext;
  page: Page;
  stdb?: StdbTestClient;
  username: string;
}

/**
 * Open an isolated browser context for a second player, navigate to the app
 * root, and register via UI. Returns the context + page ready for interaction.
 * Call `teardownSecondPlayer` in afterEach to dispose cleanly.
 */
export async function openAndRegisterSecondPlayer(
  browser: Browser,
  username: string,
): Promise<SecondPlayer> {
  const context = await browser.newContext({
    locale: 'en-US',
    extraHTTPHeaders: { 'Accept-Language': 'en-US' },
  });
  const page = await context.newPage();

  await page.goto('/');
  await page.getByTestId('username-input').fill(username);
  await page.getByTestId('register-submit').click();

  // Wait until STDB credentials are persisted (registration confirmed)
  await page.waitForFunction(
    () => localStorage.getItem('spacetimemath_credentials') !== null,
    { timeout: 15_000 },
  );

  const stdb = await connectAsBrowserSession(page);
  return { context, page, stdb, username };
}

/**
 * Dispose a second player: delete backend rows then close context.
 */
export async function teardownSecondPlayer(player: SecondPlayer | undefined): Promise<void> {
  if (!player) return;
  await cleanupTestUser(player.stdb).catch(() => {});
  await player.context.close().catch(() => {});
}
