import { test, expect } from '@playwright/test';
import { waitForApp } from './helpers';

test.describe('Auth Validation & Forgot Password', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  test('shows forgot password link on login screen', async ({ page }) => {
    // The forgot password link should be visible on the login screen
    const forgotLink = page.locator('[data-testid="forgot-password-link"]');
    const forgotText = page.getByText('Forgot Password?');

    const linkVisible = await forgotLink.isVisible({ timeout: 10000 }).catch(() => false);
    const textVisible = await forgotText.isVisible({ timeout: 3000 }).catch(() => false);

    expect(linkVisible || textVisible).toBeTruthy();
  });

  test('shows email validation error for invalid email', async ({ page }) => {
    const emailInput = page.locator('[data-testid="login-email-input"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });

    // Type an invalid email
    await emailInput.fill('notanemail');
    await page.locator('[data-testid="login-password-input"]').fill('SomePassword123!');
    await page.locator('[data-testid="login-submit-button"]').click();
    await page.waitForTimeout(1000);

    // Should show an error message about invalid email
    const errorMessage = page.locator('[data-testid="login-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    const errorText = await errorMessage.textContent();
    expect(errorText?.toLowerCase()).toContain('email');
  });

  test('register button disabled when fields empty, enabled when filled', async ({ page }) => {
    // Navigate to register screen
    const registerLink = page.locator('[data-testid="login-register-link"]');
    await expect(registerLink).toBeVisible({ timeout: 10000 });
    await registerLink.click();
    await page.waitForTimeout(1000);

    const registerButton = page.locator('[data-testid="register-submit-button"]');
    await expect(registerButton).toBeVisible({ timeout: 5000 });

    // Button should be disabled initially (no fields filled)
    const isDisabledBefore = await registerButton.isDisabled().catch(() => false);
    const opacityBefore = await registerButton.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).opacity);
    }).catch(() => 1);
    expect(isDisabledBefore || opacityBefore < 1).toBeTruthy();

    // Fill email and password
    await page.locator('[data-testid="register-email-input"]').fill('test@example.com');
    await page.locator('[data-testid="register-password-input"]').fill('StrongPass123!');
    await page.waitForTimeout(500);

    // Button should now be enabled
    const isDisabledAfter = await registerButton.isDisabled().catch(() => false);
    const opacityAfter = await registerButton.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).opacity);
    }).catch(() => 1);
    expect(!isDisabledAfter && opacityAfter >= 1).toBeTruthy();
  });

  test('forgot password screen loads', async ({ page }) => {
    // Tap the forgot password link
    const forgotLink = page.locator('[data-testid="forgot-password-link"]');
    await expect(forgotLink).toBeVisible({ timeout: 10000 });
    await forgotLink.click();
    await page.waitForTimeout(1500);

    // Verify the forgot password screen renders
    const forgotEmailInput = page.locator('[data-testid="forgot-email-input"]');
    const forgotSubmitButton = page.locator('[data-testid="forgot-submit-button"]');
    const resetTitle = page.getByText(/Reset Password/i);

    const inputVisible = await forgotEmailInput.isVisible({ timeout: 5000 }).catch(() => false);
    const buttonVisible = await forgotSubmitButton.isVisible({ timeout: 3000 }).catch(() => false);
    const titleVisible = await resetTitle.isVisible({ timeout: 3000 }).catch(() => false);

    expect(inputVisible || titleVisible || buttonVisible).toBeTruthy();
  });
});
