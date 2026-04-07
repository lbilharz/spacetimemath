import { test, expect } from '@playwright/test';

test.describe('Email Payload Integration', () => {

  test('Teacher verification flow dynamically passes correct localization and user identity', async ({ page }) => {
    // 1. Setup Vercel API intercept to prevent real emails from sending and capture payload
    let capturedPayload: any = null;
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    
    await page.route('**/api/send-teacher-verif', async route => {
      capturedPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 200, json: { signature: 'mock-sig', expiresAt: Date.now() + 100000 } });
    });

    // 2. Start at the root language (en)
    await page.goto('/');

    // 3. Trigger teacher flow
    // Debug what is on the screen if it fails
    try {
      const teacherBtn = page.getByRole('button').filter({ hasText: /Teacher/i }).first();
      await teacherBtn.waitFor({ state: 'visible', timeout: 5000 });
      await teacherBtn.click();
    } catch {
      console.error('Playwright Error! Dump of page content:', await page.content());
      throw new Error('Button not found');
    }

    // 4. Fill form out
    const uniqueName = 'Frau ' + Math.floor(Math.random() * 10000);
    await page.locator('input[type="email"]').fill('teacher.e2e@example.com');
    await page.locator('input[type="text"]').fill(uniqueName);
    
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.first().check();
    await checkboxes.last().check();

    // 5. Submit
    // Ensure SpacetimeDB connection has established an identity to prevent "Connection not established" errors
    await page.waitForFunction(() => localStorage.getItem('spacetimemath_credentials') !== null, { timeout: 15000 });
    
    // Sometimes the `identity` hook re-render takes a split ms after the storage is populated
    await page.waitForTimeout(500);

    const submitBtn = page.getByRole('button', { name: /Start Level Up/i }).last();
    await submitBtn.click();
    
    try {
      await expect(page.locator('text=Verify Your Email')).toBeVisible({ timeout: 5000 });
    } catch {
      console.error('FAILED AT VERIFY STEP. Error on screen:', await page.locator('.text-red-500').textContent().catch(() => 'no error visible'));
      throw new Error('Timeout waiting for code verification step.');
    }
    
    // 7. Directly assert that the React App appended the correct user & locale metadata to the Vercel API
    expect(capturedPayload).toBeTruthy();
    expect(capturedPayload.email).toBe('teacher.e2e@example.com');
    expect(capturedPayload.name).toBe(uniqueName);
    expect(capturedPayload.locale).toMatch(/^en/);
    expect(capturedPayload.identityHex).toBeTruthy(); // Ensure SpacetimeDB hex was loaded
  });

  // Example for recovery email 
  test('Account page dynamically passes locale and user name on recovery email trigger', async ({ page }) => {
    let capturedPayload: any = null;
    await page.route('**/api/send-recovery-email', async route => {
      capturedPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 200 });
    });

    // 1. Visit root and register as Solo player
    await page.goto('/');
    
    // Choose Solo flow 
    const soloBtn = page.getByRole('button', { name: /Practice on your own/i }).last();
    await soloBtn.waitFor({ state: 'visible', timeout: 5000 });
    await soloBtn.click();
    
    const uniqueName = 'Solo ' + Math.floor(Math.random() * 10000);
    await page.locator('input[type="text"]').fill(uniqueName);
    const joinBtn = page.getByRole('button', { name: /(Start Level Up|Join)/i }).last();
    
    // Wait for STDB credentials before clicking
    await page.waitForFunction(() => localStorage.getItem('spacetimemath_credentials') !== null, { timeout: 15000 });
    await page.waitForTimeout(500);
    await joinBtn.click();
    
    // Explicitly navigate via history API for reliability
    await page.goto('/account');

    // Wait for Account page to mount
    await expect(page.locator('h1').filter({ hasText: /(Account|Profile)/i })).toBeVisible({ timeout: 10000 });

    // 2. Find recovery email section and send email
    // The recovery code may already exist, so we skip generation and go straight to email dispatch
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await emailInput.fill('recovery.e2e@example.com');

    // Find and click the Send button (look for button near email input with Send text)
    const sendBtn = page.locator('button:has-text("Send")').filter({ hasText: /recovery|email/i }).first();
    await sendBtn.click();

    // 3. Assert the recovery email API was called with correct payload
    await page.waitForTimeout(500);
    expect(capturedPayload).toBeTruthy();
    expect(capturedPayload.email).toBe('recovery.e2e@example.com');
    expect(capturedPayload.name).toBe(uniqueName);
    expect(capturedPayload.code).toBeTruthy();
    expect(capturedPayload.locale).toMatch(/^en/);
  });
});
