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

    // 3. Skip the Onboarding overlay (clicks "Los geht's" or equivalent)
    const overlayBtn = page.getByRole('button').filter({ hasText: /(Los|Skip|Später)/i });
    try {
      if (await overlayBtn.isVisible({ timeout: 5000 })) {
        await overlayBtn.click();
      }
    } catch {
      // Ignored if it doesn't appear
    }
    
    // 4. In Lobby, click "Sprint starten" (Start Solo Sprint)
    await page.waitForLoadState('networkidle');
    const startBtn = page.getByRole('button').filter({ hasText: /Sprint/i }).first();
    await startBtn.waitFor({ state: 'visible', timeout: 10000 });
    await startBtn.click();

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
