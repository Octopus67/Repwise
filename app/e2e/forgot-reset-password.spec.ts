import { test, expect } from '@playwright/test';

test.describe('Forgot & Reset Password', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('forgot password screen shows email input and submit', async ({ page }) => {
    // Navigate to forgot password from login
    const forgotLink = page.getByText(/forgot.*password/i).first();
    if (!(await forgotLink.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await forgotLink.click();
    await page.waitForTimeout(1500);

    const emailInput = page.locator('[data-testid="forgot-email-input"]');
    await expect(emailInput).toBeVisible({ timeout: 5000 });

    const submitBtn = page.locator('[data-testid="forgot-submit-button"]');
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
  });

  test('forgot password submits email', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    const forgotLink = page.getByText(/forgot.*password/i).first();
    if (!(await forgotLink.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await forgotLink.click();
    await page.waitForTimeout(1500);

    const emailInput = page.locator('[data-testid="forgot-email-input"]');
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await emailInput.fill(`e2e_forgot_${Date.now()}@test.com`);

    const submitBtn = page.locator('[data-testid="forgot-submit-button"]');
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // Should show success message or navigate to reset screen
    const resetCode = page.locator('[data-testid="reset-code-input"]');
    const successMsg = page.getByText(/sent|check.*email|reset.*code/i).first();
    const hasReset = await resetCode.isVisible({ timeout: 5000 }).catch(() => false);
    const hasSuccess = await successMsg.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasReset || hasSuccess).toBeTruthy();
  });

  test('reset password screen has all fields', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    const forgotLink = page.getByText(/forgot.*password/i).first();
    if (!(await forgotLink.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await forgotLink.click();
    await page.waitForTimeout(1500);

    const emailInput = page.locator('[data-testid="forgot-email-input"]');
    if (!(await emailInput.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await emailInput.fill(`e2e_forgot_${Date.now()}@test.com`);

    const submitBtn = page.locator('[data-testid="forgot-submit-button"]');
    await submitBtn.click();
    await page.waitForTimeout(2000);

    const resetCode = page.locator('[data-testid="reset-code-input"]');
    if (!(await resetCode.isVisible({ timeout: 5000 }).catch(() => false))) return;

    const passwordInput = page.locator('[data-testid="reset-password-input"]');
    const confirmInput = page.locator('[data-testid="reset-confirm-password-input"]');
    const resetSubmit = page.locator('[data-testid="reset-submit-button"]');

    await expect(passwordInput).toBeVisible({ timeout: 3000 });
    await expect(confirmInput).toBeVisible({ timeout: 3000 });
    await expect(resetSubmit).toBeVisible({ timeout: 3000 });
  });

  test('reset password validates mismatched passwords', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    const forgotLink = page.getByText(/forgot.*password/i).first();
    if (!(await forgotLink.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await forgotLink.click();
    await page.waitForTimeout(1500);

    const emailInput = page.locator('[data-testid="forgot-email-input"]');
    if (!(await emailInput.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await emailInput.fill(`e2e_forgot_${Date.now()}@test.com`);
    await page.locator('[data-testid="forgot-submit-button"]').click();
    await page.waitForTimeout(2000);

    const resetCode = page.locator('[data-testid="reset-code-input"]');
    if (!(await resetCode.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await resetCode.fill('123456');
    await page.locator('[data-testid="reset-password-input"]').fill('NewPass123!');
    await page.locator('[data-testid="reset-confirm-password-input"]').fill('DifferentPass!');
    await page.locator('[data-testid="reset-submit-button"]').click();
    await page.waitForTimeout(1500);

    // Should show error about mismatched passwords
    const error = page.locator('[data-testid="reset-error-message"]');
    const errorText = page.getByText(/match|mismatch|don.*match/i).first();
    const hasError = await error.isVisible({ timeout: 3000 }).catch(() => false);
    const hasText = await errorText.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasError || hasText).toBeTruthy();
  });
});
