import { Page, expect } from '@playwright/test';

export const TEST_USER = {
  email: `e2e_${Date.now()}@test.com`,
  password: 'TestPass123!',
};

export async function waitForApp(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Give React Native Web time to hydrate
  await page.waitForTimeout(3000);
}

export async function registerUser(page: Page) {
  // Navigate to register screen
  const registerLink = page.locator('[data-testid="login-register-link"]');
  if (await registerLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await registerLink.click();
    await page.waitForTimeout(1000);
  }

  // Fill registration form
  await page.locator('[data-testid="register-email-input"]').fill(TEST_USER.email);
  await page.locator('[data-testid="register-password-input"]').fill(TEST_USER.password);
  await page.locator('[data-testid="register-confirm-password-input"]').fill(TEST_USER.password);
  await page.locator('[data-testid="register-submit-button"]').click();
  await page.waitForTimeout(3000);
}

export async function loginUser(page: Page) {
  await page.locator('[data-testid="login-email-input"]').fill(TEST_USER.email);
  await page.locator('[data-testid="login-password-input"]').fill(TEST_USER.password);
  await page.locator('[data-testid="login-submit-button"]').click();
  await page.waitForTimeout(3000);
}

export async function ensureLoggedIn(page: Page) {
  await waitForApp(page);

  // Check if we're already on the dashboard
  const dashboard = page.locator('[data-testid="dashboard-screen"]');
  if (await dashboard.isVisible({ timeout: 5000 }).catch(() => false)) {
    return;
  }

  // Check if we're on login screen
  const loginInput = page.locator('[data-testid="login-email-input"]');
  if (await loginInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Register a new user
    await registerUser(page);

    // Wait for navigation — could be dashboard or onboarding
    await page.waitForTimeout(2000);

    // If on dashboard, done
    if (await dashboard.isVisible({ timeout: 5000 }).catch(() => false)) {
      return;
    }

    // If onboarding appeared, try to skip it
    const skipButton = page.getByText(/skip/i);
    if (await skipButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipButton.first().click();
      await page.waitForTimeout(2000);
    }

    // Check dashboard again
    if (await dashboard.isVisible({ timeout: 5000 }).catch(() => false)) {
      return;
    }

    // Last resort: try logging in directly
    await page.goto('/');
    await page.waitForTimeout(2000);
    if (await loginInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginUser(page);
      await page.waitForTimeout(2000);
    }
  }
}

export async function navigateToTab(page: Page, tabName: string) {
  const tabId = tabName.toLowerCase();
  const tab = page.locator(`[data-testid="tab-${tabId}"]`);
  await expect(tab).toBeVisible({ timeout: 10000 });
  await tab.click();
  await page.waitForTimeout(1500);
}
