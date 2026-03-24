import { test, expect } from '@playwright/test';

test.describe('Sprint Reliability E2E', () => {

  test('Solo Sprint loads successfully and displays first problem', async ({ page }) => {

    // 1. Navigate to the app lobby
    await page.goto('/');

    // 2. Fresh session starts at the registration page.
    const nameInput = page.locator('input[type="text"]');
    await nameInput.waitFor({ state: 'visible', timeout: 10000 });
    await nameInput.fill('E2E Tester');
    
    // Press enter or click the submit button
    await nameInput.press('Enter');

    // 3. Defensively wait for the Onboarding overlay to fade in after registration
    const overlayBtn = page.getByRole('button').filter({ hasText: '→' }).first();
    await overlayBtn.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});

    let attempts = 0;
    while (attempts < 10) {
      attempts++;
      try {
        // Pre-click Tier 1 on the Ladder to guarantee the backend finds assigned math sequences
        await page.getByText(/Tier 1/i).first().click({ timeout: 50 }).catch(() => {});

        if (await overlayBtn.isVisible({ timeout: 500 })) {
          await overlayBtn.click();
          await page.waitForTimeout(600); // wait for next slide/modal animation
        } else {
          break; // Overlay is gone
        }
      } catch (err) {
        await page.waitForTimeout(300);
      }
    }
    
    // 4. In Lobby, click "Sprint starten" (Start Solo Sprint), unless the Onboarding
    // already fired us directly into the sprint page path.
    let isAlreadySprinting = false;
    try {
      await page.waitForURL('**/sprint', { timeout: 3000 });
      isAlreadySprinting = true;
    } catch {
      isAlreadySprinting = false;
    }
    
    if (!isAlreadySprinting) {
      const startBtn = page.getByRole('button').filter({ hasText: /Sprint/i }).first();
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
    const multSymbol = page.locator('text=×');
    await expect(multSymbol).toBeVisible();
    
    console.log('E2E Test Success: Sprint initialized without hanging!');
  });

});
