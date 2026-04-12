import { test, expect } from '@playwright/test';

test.describe('Authentication & Registration Flow', () => {

  test('Registration with gamertag drops into Lobby', async ({ page }) => {
    await page.goto('/');

    // Pre-filled gamertag input should be visible
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 10000 });

    // Should be pre-filled with a generated gamertag
    const prefilled = await nameInput.inputValue();
    expect(prefilled.length).toBeGreaterThan(0);

    // Optionally change the name
    await nameInput.clear();
    await nameInput.fill(`E2E Tester ${Math.floor(Math.random() * 1000)}`);

    // **CRITICAL**: Wait for STDB credentials before clicking submit
    await page.waitForFunction(() => localStorage.getItem('spacetimemath_credentials') !== null, { timeout: 15000 });
    await page.waitForTimeout(500);

    // Submit
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Should arrive at the Lobby component. Since it natively renders on the root '/' route,
    // we assert the Lobby is fully loaded by checking for the Progress directory link.
    await expect(page.locator('a[href="/progress"]').first()).toBeVisible({ timeout: 15000 });
  });

});
