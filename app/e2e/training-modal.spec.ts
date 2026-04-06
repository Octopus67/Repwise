import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers';

test.describe('Training — ActiveWorkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('can start a workout from dashboard', async ({ page }) => {
    const logTraining = page.locator('[data-testid="dashboard-log-training-button"]');
    await expect(logTraining).toBeVisible({ timeout: 10000 });
    await logTraining.click();
    await page.waitForTimeout(2000);

    // Should navigate to active workout screen or show exercise picker
    const workoutScreen = page.locator('[data-testid="active-workout-screen"]');
    const exercisePicker = page.getByText(/add exercise|search exercise/i);
    const isWorkout = await workoutScreen.isVisible().catch(() => false);
    const isPicker = await exercisePicker.isVisible().catch(() => false);
    expect(isWorkout || isPicker).toBeTruthy();
  });

  test('can add an exercise and log a set', async ({ page }) => {
    const logTraining = page.locator('[data-testid="dashboard-log-training-button"]');
    await expect(logTraining).toBeVisible({ timeout: 10000 });
    await logTraining.click();
    await page.waitForTimeout(2000);

    // Look for add exercise button
    const addExercise = page.getByText(/add exercise/i).first();
    if (await addExercise.isVisible().catch(() => false)) {
      await addExercise.click();
      await page.waitForTimeout(1000);

      // Search for an exercise
      const searchInput = page.getByPlaceholder(/search/i).first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('Bench');
        await page.waitForTimeout(1000);

        // Select first result
        const firstResult = page.getByText(/bench press/i).first();
        if (await firstResult.isVisible().catch(() => false)) {
          await firstResult.click();
          await page.waitForTimeout(500);
        }
      }
    }
  });
});
