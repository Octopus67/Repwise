import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers';

test.describe('Bodyweight Modal', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    // Open bodyweight modal from dashboard
    const logBodyweight = page.locator('[data-testid="dashboard-log-bodyweight-button"]');
    await expect(logBodyweight).toBeVisible({ timeout: 10000 });
    await logBodyweight.click();
    await page.waitForTimeout(1000);
  });

  test('opens bodyweight modal', async ({ page }) => {
    const modal = page.locator('[data-testid="add-bodyweight-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('shows weight input', async ({ page }) => {
    const modal = page.locator('[data-testid="add-bodyweight-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const weightInput = page.locator('[data-testid="bodyweight-weight-input"]');
    await expect(weightInput).toBeVisible({ timeout: 5000 });
  });

  test('shows unit toggle', async ({ page }) => {
    const modal = page.locator('[data-testid="add-bodyweight-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const unitToggle = page.locator('[data-testid="bodyweight-unit-toggle"]');
    await expect(unitToggle).toBeVisible({ timeout: 5000 });
  });

  test('shows save button', async ({ page }) => {
    const modal = page.locator('[data-testid="add-bodyweight-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const submit = page.locator('[data-testid="bodyweight-submit-button"]');
    await expect(submit).toBeVisible({ timeout: 5000 });
  });

  test('can close bodyweight modal', async ({ page }) => {
    const modal = page.locator('[data-testid="add-bodyweight-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const cancelButton = page.locator('[data-testid="bodyweight-cancel-button"]');
    if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelButton.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(1000);

    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('can enter weight value', async ({ page }) => {
    const modal = page.locator('[data-testid="add-bodyweight-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const weightInput = page.locator('[data-testid="bodyweight-weight-input"]');
    await weightInput.fill('82.5');

    const value = await weightInput.inputValue();
    expect(value).toBe('82.5');
  });
});
