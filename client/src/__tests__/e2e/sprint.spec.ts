import { test, expect } from '@playwright/test';

test.describe('Sprint Reliability E2E', () => {

  test('Solo Sprint loads successfully and displays first problem', async ({ page }) => {

    // 1. Navigate to the app lobby
    await page.goto('/');

    // 2. Fresh session starts at the registration page.
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 10000 });
    
    // Fill the gamertag slightly differently to avoid conflicts
    await nameInput.clear();
    await nameInput.fill(`Sprint Tester ${Math.floor(Math.random() * 1000)}`);

    // **CRITICAL**: Wait for STDB credentials before clicking submit
    await page.waitForFunction(() => localStorage.getItem('spacetimemath_credentials') !== null, { timeout: 15000 });
    await page.waitForTimeout(500);

    // Submit
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Ensure the credentials loaded
    await page.waitForFunction(() => localStorage.getItem('spacetimemath_credentials') !== null, { timeout: 15000 });

    // 4. Clear the Onboarding Overlay that appears for brand new users.
    // It has multiple slides. The final slide's button triggers the sprint.
    const overlayBtn = page.getByRole('button').filter({ hasText: '→' }).first();
    await overlayBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    
    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      try {
        if (await overlayBtn.isVisible({ timeout: 500 })) {
          await overlayBtn.click();
          await page.waitForTimeout(600);
        } else {
          break;
        }
      } catch {
        break;
      }
    }
    
    // We arrived at lobby!
    // Since auto-play into sprints or splash overlays might occur depending on tier config, let's defensively check.
    let isAlreadySprinting = false;
    try {
      await page.waitForURL('**/sprint', { timeout: 3000 });
      isAlreadySprinting = true;
    } catch {
      isAlreadySprinting = false;
    }
    
    if (!isAlreadySprinting) {
      // Wait for the primary Start Sprint button in the lobby via test ID
      const startBtn = page.getByTestId('start-sprint-button');
      await startBtn.waitFor({ state: 'visible', timeout: 10000 });
      await startBtn.click();
    }

    // 5. Watch countdown 3 2 1 Go!
    // It shouldn't get stuck on "Lade Aufgaben..." ("Loading tasks...")
    // It should eventually show the math problem: "WHAT IS X x Y"
    const problemHeader = page.locator('text=WHAT IS').or(page.locator('text=WAS IST'));
    
    // If it hangs indefinitely here, then the `db.query` / `useTable` sinkhole bug has regressed.
    await problemHeader.waitFor({ state: 'visible', timeout: 15000 });

    // 6. Verify the math problem is genuinely visible and parseable
    const multSymbol = page.locator('text=×').first();
    await expect(multSymbol).toBeVisible();
    
    console.log('E2E Test Success: Sprint initialized without hanging!');
  });

});
