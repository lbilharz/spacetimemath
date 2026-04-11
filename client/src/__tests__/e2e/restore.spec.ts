import { test, expect } from '@playwright/test';

test.describe('Account Restoration via Email Flow', () => {
  
  test.skip('Successfully requests and submits email verification code to restore account', async ({ page }) => {
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

    // 3. Trigger returning user flow to get to RegisterPage
    try {
      const returningBtn = page.getByRole('button').filter({ hasText: /Already have an account/i }).first();
      await returningBtn.waitFor({ state: 'visible', timeout: 5000 });
      await returningBtn.click();
    } catch {
      console.error('Playwright Error! Dump of page content:', await page.content());
      throw new Error('Returning user button not found');
    }

    // 4. Ensure we are on the recovery page and SpacetimeDB connection has established
    await expect(page.locator('h1').filter({ hasText: /(Link|Enter)/i }).first()).toBeVisible({ timeout: 5000 });

    // Wait for STDB credentials before clicking
    await page.waitForFunction(() => localStorage.getItem('spacetimemath_credentials') !== null, { timeout: 15000 });
    await page.waitForTimeout(500); // Give the identity hook time to settle
    
    // 5. Select the "Email Verification" option instead of direct Recovery Code
    const emailRecoveryBtn = page.getByRole('button', { name: /Send Email/i }).first();
    await emailRecoveryBtn.waitFor({ state: 'visible', timeout: 5000 });

    const recoveryEmailInput = page.locator('input[type="email"]').first();
    await recoveryEmailInput.fill('teacher.restore.e2e@example.com');
    await emailRecoveryBtn.click();

    // 6. Assert that the Vercel API was hit with the exact correct payload
    await page.waitForTimeout(500); // Wait for fetch
    expect(capturedPayload).toBeTruthy();
    expect(capturedPayload.email).toBe('teacher.restore.e2e@example.com');
    expect(capturedPayload.locale).toMatch(/^en/);

    // 7. Test the Verification Code Input UI
    const verifyHeading = page.locator('text=Enter 6-Digit Code').first();
    await expect(verifyHeading).toBeVisible({ timeout: 5000 });

    const codeInput = page.locator('input[type="text"]').first();
    await codeInput.fill('123456');

    // Due to the SpacetimeDB backend logic failing here if the signature is invalid 
    // or the player doesn't exist, this E2E test asserts the SpacetimeDB call executes 
    // without "no such reducer" error, but correctly shows backend validation errors.
    const verifyLoginBtn = page.getByRole('button', { name: /VERIFY LOGIN/i }).first();
    await verifyLoginBtn.click();

    // Expect the backend to reject our mocked signature OR reject because player doesn't exist.
    // This confirms the reducer is executing on the server (i.e. NO "no such reducer" error).
    const errorMsg = page.locator('.text-red-500').first();
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
    
    const text = await errorMsg.textContent();
    // It should NEVER say "no such reducer", but rather a validation error from Rust.
    expect(text?.toLowerCase()).not.toContain('no such reducer');
  });

});
