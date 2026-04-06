import { test, expect } from '@playwright/test';
import { waitForApp } from './helpers';

test.describe('Auth Validation & Forgot Password', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  test('shows forgot password link on login screen', async ({ page }) => {
    const forgotLink = page.locator('[data-testid="forgot-password-link"]');
    const forgotText = page.getByText('Forgot Password?');
    const linkVisible = await forgotLink.isVisible({ timeout: 10000 }).catch(() => false);
    const textVisible = await forgotText.isVisible({ timeout: 3000 }).catch(() => false);
    expect(linkVisible || textVisible).toBeTruthy();
  });

  test('shows email validation error for invalid email', async ({ page }) => {
    const emailInput = page.locator('[data-testid="login-email-input"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill('notanemail');
    await page.locator('[data-testid="login-password-input"]').fill('SomePassword123!');
    await page.locator('[data-testid="login-submit-button"]').click();
    await page.waitForTimeout(1500);

    // Login screen shows emailError as inline text or error banner
    const errorBanner = page.locator('[data-testid="login-error-message"]');
    const emailErrorText = page.getByText(/valid email/i);
    const bannerVisible = await errorBanner.isVisible({ timeout: 3000 }).catch(() => false);
    const textVisible = await emailErrorText.isVisible({ timeout: 3000 }).catch(() => false);
    expect(bannerVisible || textVisible).toBeTruthy();
  });

  test('register screen shows error when submitting empty fields', async ({ page }) => {
    const registerLink = page.locator('[data-testid="login-register-link"]');
    await expect(registerLink).toBeVisible({ timeout: 10000 });
    await registerLink.click();
    await page.waitForTimeout(1000);

    const registerButton = page.locator('[data-testid="register-submit-button"]');
    await expect(registerButton).toBeVisible({ timeout: 5000 });

    // Click register with empty fields — should show error
    await registerButton.click();
    await page.waitForTimeout(1000);

    const errorBanner = page.locator('[data-testid="register-error-message"]');
    const errorText = page.getByText(/required|email|password/i);
    const bannerVisible = await errorBanner.isVisible({ timeout: 3000 }).catch(() => false);
    const textVisible = await errorText.first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(bannerVisible || textVisible).toBeTruthy();
  });

  test('forgot password screen loads', async ({ page }) => {
    const forgotLink = page.locator('[data-testid="forgot-password-link"]');
    await expect(forgotLink).toBeVisible({ timeout: 10000 });
    await forgotLink.click();
    await page.waitForTimeout(1500);

    const forgotEmailInput = page.locator('[data-testid="forgot-email-input"]');
    const forgotSubmitButton = page.locator('[data-testid="forgot-submit-button"]');
    const resetTitle = page.getByText(/Reset Password/i);
    const inputVisible = await forgotEmailInput.isVisible({ timeout: 5000 }).catch(() => false);
    const buttonVisible = await forgotSubmitButton.isVisible({ timeout: 3000 }).catch(() => false);
    const titleVisible = await resetTitle.isVisible({ timeout: 3000 }).catch(() => false);
    expect(inputVisible || titleVisible || buttonVisible).toBeTruthy();
  });
});
