import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateToTab } from './helpers';

test.describe('Training Modal', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    // Open training modal from dashboard
    const logTraining = page.locator('[data-testid="dashboard-log-training-button"]');
    await expect(logTraining).toBeVisible({ timeout: 10000 });
    await logTraining.click();
    await page.waitForTimeout(1000);
  });

  test('opens training modal', async ({ page }) => {
    const modal = page.locator('[data-testid="add-training-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('shows template section', async ({ page }) => {
    const modal = page.locator('[data-testid="add-training-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const templateToggle = page.locator('[data-testid="training-template-toggle"]');
    await expect(templateToggle).toBeVisible({ timeout: 5000 });
  });

  test('shows exercise search', async ({ page }) => {
    const modal = page.locator('[data-testid="add-training-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const search = page.locator('[data-testid="training-exercise-search"]');
    await expect(search).toBeVisible({ timeout: 5000 });
  });

  test('shows copy last workout button', async ({ page }) => {
    const modal = page.locator('[data-testid="add-training-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const copyLast = page.locator('[data-testid="training-copy-last"]');
    await expect(copyLast).toBeVisible({ timeout: 5000 });
  });

  test('shows save session button', async ({ page }) => {
    const modal = page.locator('[data-testid="add-training-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const submit = page.locator('[data-testid="training-submit-button"]');
    await expect(submit).toBeVisible({ timeout: 5000 });
  });

  test('can close training modal', async ({ page }) => {
    const modal = page.locator('[data-testid="add-training-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const cancelButton = page.locator('[data-testid="training-cancel-button"]');
    if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelButton.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(1000);

    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });
});
