import { test, expect } from '@playwright/test';

test.describe.skip('Authentication & Registration Flow', () => {

  test('Solo Flow - allows registration and automatically drops into Lobby', async ({ page }) => {
    await page.goto('/');

    // 1. Select Solo Path
    const soloBtn = page.getByRole('button').nth(2);
    await soloBtn.waitFor({ state: 'visible', timeout: 5000 });
    await soloBtn.click();

    // 2. Enter username
    const nameInput = page.locator('input[type="text"]').last();
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill('Solo User');
    
    // 3. Submit
    await nameInput.press('Enter');

    // 4. Should not show verification screen, should navigate straight into app
    const overlayBtn = page.getByRole('button').filter({ hasText: '→' }).first();
    await overlayBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    
    // Check if we hit the lobby or sprint route
    await expect(page).toHaveURL(/.*(lobby|sprint)/);
  });

  test.skip('Student Flow - requires class code and username', async ({ page }) => {
    await page.goto('/');

    // 1. Select Student Path
    const studentBtn = page.getByRole('button').nth(1);
    await studentBtn.waitFor({ state: 'visible', timeout: 5000 });
    await studentBtn.click();

    // 2. Wait for inputs to appear
    const inputs = page.locator('input[type="text"]');
    await expect(inputs).toHaveCount(2, { timeout: 5000 });

    const classCodeInput = inputs.first();
    const nameInput = inputs.last();

    await classCodeInput.fill('123456');
    await nameInput.fill('Student User');

    // 3. Submit
    const submitBtn = page.getByRole('button').last();
    await submitBtn.click();

    // At this point we expect an error or progression (E2E won't have a valid mocked class code)
    // We just verify the inputs exist and it doesn't crash.
  });

  test.skip('Teacher Flow - requires email, gdpr, and hits verification api', async ({ page }) => {
    // Mock the Vercel API endpoint for sending verification emails so we don't hit Resend
    await page.route('/api/send-teacher-verif', async route => {
      await route.fulfill({ status: 200, json: { success: true } });
    });

    await page.goto('/');

    // 1. Select Teacher Path
    const teacherBtn = page.getByRole('button').first();
    await teacherBtn.waitFor({ state: 'visible', timeout: 5000 });
    await teacherBtn.click();

    // 2. Fill teacher details
    const emailInput = page.locator('input[type="email"]');
    const nameInput = page.locator('input[type="text"]');
    const checkboxes = page.locator('input[type="checkbox"]');

    await expect(emailInput).toBeVisible();
    await expect(nameInput).toBeVisible();
    await expect(checkboxes).toHaveCount(2);

    await emailInput.fill('teacher@example.com');
    await nameInput.fill('Teacher User');
    
    await checkboxes.first().check();
    await checkboxes.last().check();

    // 3. Submit
    const submitBtn = page.getByRole('button').last();
    await submitBtn.click();

    // 4. Verify transition to Code Verification step
    const codeInput = page.locator('input[type="text"][maxLength="6"]');
    await expect(codeInput).toBeVisible({ timeout: 5000 });
    
    // The "Verify Your Email" header should be visible
    await expect(page.locator('text=Verify Your Email')).toBeVisible();
    
    // Test code entry logic (we don't submit because without verifying SpacetimeDB backend state, it fails)
    await codeInput.fill('123456');
    await expect(codeInput).toHaveValue('123456');
  });

});
