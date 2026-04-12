import { test, expect } from '@playwright/test';

test.describe('Account Restoration via Email Flow', () => {
  
  test('Successfully requests and submits email verification code to restore account', async ({ page }) => {
    // 1. Setup Vercel API intercept to prevent real emails from sending and capture payload
    let capturedPayload: any = null;
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    
    // We mock the send-email-login API which generates the HMAC signature and expiration
    await page.route('**/api/send-email-login', async route => {
      capturedPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 200, json: { signature: 'mock-auth-sig', expiresAt: Date.now() + 900000 } });
    });

    // 2. Start at the root language (en)
    await page.goto('/');

    // 3. Trigger returning user flow to get to Restore modes
    try {
      // Find the circular restore link button which contains the ↺ icon
      const restoreLink = page.getByRole('button').filter({ hasText: '↺' }).first();
      await restoreLink.waitFor({ state: 'visible', timeout: 5000 });
      await restoreLink.click();
    } catch {
      console.error('Playwright Error! Dump of page content:', await page.content());
      throw new Error('Restore link not found');
    }

    // 4. Wait for the restore options, then select the "I know my email" card
    try {
      const emailRestoreCard = page.locator('text=I know my email').first();
      await emailRestoreCard.waitFor({ state: 'visible', timeout: 5000 });
      await emailRestoreCard.click();
    } catch {
      console.error('Playwright Error! Failed to select email mode:', await page.content());
      throw new Error('Email selection card not found');
    }

    // 5. Fill out the email input and hit submit
    const recoveryEmailInput = page.locator('input[type="email"]').first();
    await expect(recoveryEmailInput).toBeVisible({ timeout: 5000 });
    await recoveryEmailInput.fill('teacher.restore.e2e@example.com');
    await recoveryEmailInput.press('Enter');

    // 6. Assert that the Vercel API was hit with the exact correct payload
    await page.waitForTimeout(500); // Wait for fetch
    expect(capturedPayload).toBeTruthy();
    expect(capturedPayload.email).toBe('teacher.restore.e2e@example.com');
    // Ensure the language detection correctly populated locale
    expect(capturedPayload.locale).toBeDefined();

    // 7. Test the 6-Digit OTP Verification Code Input UI
    // Ensure the UI transition occurred and the 6-digit code input emerged
    const codeInput = page.locator('input[type="text"][maxLength="6"]').first();
    await expect(codeInput).toBeVisible({ timeout: 5000 });
    await codeInput.fill('123456');

    // Due to the SpacetimeDB backend logic failing here if the signature is invalid 
    // or the player doesn't exist, this E2E test asserts the SpacetimeDB call executes 
    // without "no such reducer" error, but correctly shows backend validation errors.
    const verifyLoginBtn = page.getByRole('button').filter({ hasText: /(VERIFY|BESTÄTIGEN|XÁC NHẬN|Підтвердити|Ok)/i }).first();
    if (await verifyLoginBtn.isVisible()) {
        await verifyLoginBtn.click();
    } else {
        await codeInput.press('Enter');
    }

    // Wait for STDB credentials before clicking
    await page.waitForFunction(() => localStorage.getItem('spacetimemath_credentials') !== null, { timeout: 15000 });
    await page.waitForTimeout(500); // Give the identity hook time to settle

    // Expect the backend to reject our mocked signature OR reject because player doesn't exist.
    // This confirms the reducer is executing on the server (i.e. NO "no such reducer" error).
    const errorMsg = page.locator('.text-red-500').first();
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
    
    const text = await errorMsg.textContent();
    // It should NEVER say "no such reducer", but rather a validation error from Rust.
    expect(text?.toLowerCase()).not.toContain('no such reducer');
  });

});
