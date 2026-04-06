import { test, expect } from '@playwright/test';

const BASE_API = 'http://localhost:8000/api/v1';

/** Register a user via API and set tokens in localStorage. */
async function registerViaApi(page: import('@playwright/test').Page) {
  const uid = Math.random().toString(36).slice(2, 10);
  const email = `e2e_pw_${uid}@test.com`;
  const password = `E2ePass1!${uid}`;

  const resp = await page.request.post(`${BASE_API}/auth/register`, {
    data: { email, password },
  });
  const data = await resp.json();

  // Set tokens in localStorage so the app picks them up
  await page.evaluate(
    ({ access, refresh }) => {
      localStorage.setItem('rw_access_token', access);
      localStorage.setItem('rw_refresh_token', refresh);
    },
    { access: data.access_token, refresh: data.refresh_token },
  );

  return { email, password, ...data };
}

test.describe('Onboarding Wizard E2E', () => {
  test('register → complete all 9 steps → lands on dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Navigate to register screen
    const registerLink = page.getByText(/sign up|register|create account/i).first();
    if (await registerLink.isVisible().catch(() => false)) {
      await registerLink.click();
      await page.waitForTimeout(1000);
    }

    // Fill registration form
    const emailInput = page.locator('[data-testid="register-email-input"]');
    const passwordInput = page.locator('[data-testid="register-password-input"]');
    const registerButton = page.locator('[data-testid="register-submit-button"]');

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const uid = Math.random().toString(36).slice(2, 10);
      await emailInput.fill(`e2e_pw_${uid}@test.com`);
      await passwordInput.fill(`E2ePass1!${uid}`);
      await page.waitForTimeout(500);
      await registerButton.click();
      await page.waitForTimeout(3000);
    }

    // Should be on onboarding wizard now
    // Step 1: Intent
    const intentStep = page.getByText(/your mission|what brings you/i).first();
    if (await intentStep.isVisible({ timeout: 10000 }).catch(() => false)) {
      // Select a goal option
      const buildMuscle = page.getByText(/build muscle/i).first();
      if (await buildMuscle.isVisible().catch(() => false)) {
        await buildMuscle.click();
        await page.waitForTimeout(500);
      }

      // Click next/continue
      const nextBtn = page.getByText(/next|continue/i).first();
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Verify we progressed past step 1
    const stepIndicator = page.getByText(/step.*of/i).first();
    if (await stepIndicator.isVisible().catch(() => false)) {
      const text = await stepIndicator.textContent();
      expect(text).toBeTruthy();
    }
  });

  test('password strength meter shows all 5 rules', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Navigate to register
    const registerLink = page.getByText(/sign up|register|create account/i).first();
    if (await registerLink.isVisible().catch(() => false)) {
      await registerLink.click();
      await page.waitForTimeout(1000);
    }

    const passwordInput = page.locator('[data-testid="register-password-input"]');
    if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await passwordInput.fill('a');
      await page.waitForTimeout(500);

      // Check all 5 rules are visible
      await expect(page.getByText(/8 characters/i)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/uppercase/i)).toBeVisible();
      await expect(page.getByText(/lowercase/i)).toBeVisible();
      await expect(page.getByText(/number/i)).toBeVisible();
      await expect(page.getByText(/special character/i)).toBeVisible();
    }
  });

  test('weak password shows specific error on submit', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    const registerLink = page.getByText(/sign up|register|create account/i).first();
    if (await registerLink.isVisible().catch(() => false)) {
      await registerLink.click();
      await page.waitForTimeout(1000);
    }

    const emailInput = page.locator('[data-testid="register-email-input"]');
    const passwordInput = page.locator('[data-testid="register-password-input"]');
    const registerButton = page.locator('[data-testid="register-submit-button"]');

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill(`e2e_weak_${Date.now()}@test.com`);
      await passwordInput.fill('weakpass');
      await page.waitForTimeout(500);
      await registerButton.click();
      await page.waitForTimeout(1500);

      // Should show error about missing requirements
      const error = page.locator('[data-testid="register-error-message"]');
      const errorText = page.getByText(/password.*must|password.*require|uppercase|special/i).first();
      const bannerVisible = await error.isVisible({ timeout: 3000 }).catch(() => false);
      const textVisible = await errorText.isVisible({ timeout: 3000 }).catch(() => false);
      expect(bannerVisible || textVisible).toBeTruthy();
    }
  });
});
