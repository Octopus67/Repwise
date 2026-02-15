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

  test('shows ToS checkbox on register screen', async ({ page }) => {
    // Navigate to register screen
    const registerLink = page.locator('[data-testid="login-register-link"]');
    await expect(registerLink).toBeVisible({ timeout: 10000 });
    await registerLink.click();
    await page.waitForTimeout(1000);

    // Verify ToS checkbox text is visible
    const tosText = page.getByText(/I agree to the Terms of Service/i);
    await expect(tosText).toBeVisible({ timeout: 5000 });
  });

  test('register button disabled without ToS', async ({ page }) => {
    // Navigate to register screen
    const registerLink = page.locator('[data-testid="login-register-link"]');
    await expect(registerLink).toBeVisible({ timeout: 10000 });
    await registerLink.click();
    await page.waitForTimeout(1000);

    // The register button should be disabled before checking ToS
    const registerButton = page.locator('[data-testid="register-submit-button"]');
    await expect(registerButton).toBeVisible({ timeout: 5000 });

    // Check that the button is disabled (opacity or disabled attribute)
    const isDisabled = await registerButton.isDisabled().catch(() => false);
    const opacity = await registerButton.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return parseFloat(style.opacity);
    }).catch(() => 1);

    // Button should be disabled or have reduced opacity
    expect(isDisabled || opacity < 1).toBeTruthy();
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
