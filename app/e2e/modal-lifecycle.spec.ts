import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers';

test.describe('Modal Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('open nutrition modal and close via X button', async ({ page }) => {
    const logFoodBtn = page.locator('[data-testid="dashboard-log-food-button"]');
    await expect(logFoodBtn).toBeVisible({ timeout: 10000 });
    await logFoodBtn.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('[data-testid="add-nutrition-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Close via X button
    const closeBtn = page.locator('[data-testid="nutrition-cancel-button"]');
    await expect(closeBtn).toBeVisible({ timeout: 3000 });
    await closeBtn.click();
    await page.waitForTimeout(1000);

    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('training button opens workout flow', async ({ page }) => {
    const logTrainingBtn = page.locator('[data-testid="dashboard-log-training-button"]');
    await expect(logTrainingBtn).toBeVisible({ timeout: 10000 });
    await logTrainingBtn.click();
    await page.waitForTimeout(2000);

    // Training button may open a modal OR navigate to ActiveWorkout screen
    const modal = page.locator('[data-testid="add-training-modal"]');
    const isModal = await modal.isVisible({ timeout: 3000 }).catch(() => false);

    if (isModal) {
      const closeBtn = page.locator('[data-testid="training-cancel-button"]');
      await closeBtn.click();
      await page.waitForTimeout(1000);
      await expect(modal).not.toBeVisible({ timeout: 5000 });
    } else {
      // ActiveWorkout screen — verify by content
      const addExercise = page.getByText('Add Exercise');
      await expect(addExercise).toBeVisible({ timeout: 5000 });
    }
  });

  test('open bodyweight modal and close via X button', async ({ page }) => {
    // Bodyweight button may be a quick action or in the dashboard
    const bwBtn = page.locator('[data-testid="dashboard-log-bodyweight-button"]');
    if (!(await bwBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await bwBtn.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('[data-testid="add-bodyweight-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const closeBtn = page.locator('[data-testid="bodyweight-cancel-button"]');
    await closeBtn.click();
    await page.waitForTimeout(1000);

    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });
});
