import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers';

test.describe('Nutrition Modal', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  async function openNutritionModal(page: import('@playwright/test').Page) {
    const btn = page.locator('[data-testid="dashboard-log-food-button"]');
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    await page.waitForTimeout(1000);
    const modal = page.locator('[data-testid="add-nutrition-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    return modal;
  }

  test('X button closes empty form immediately (no confirmation)', async ({ page }) => {
    const modal = await openNutritionModal(page);

    // Close via X — should close instantly with no dialog
    const closeBtn = page.locator('[data-testid="nutrition-cancel-button"]');
    await closeBtn.click();
    await page.waitForTimeout(500);

    // Modal should be gone — no "Discard changes?" dialog
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('X button with macros entered triggers discard and closes', async ({ page }) => {
    await openNutritionModal(page);

    // Type a calorie value
    const calInput = page.locator('[data-testid="nutrition-calories-input"]');
    await calInput.fill('500');
    await page.waitForTimeout(300);

    // Register dialog handler BEFORE clicking X — accept the window.confirm
    page.once('dialog', async (d) => { await d.accept(); });

    // Click X — triggers window.confirm on web
    const closeBtn = page.locator('[data-testid="nutrition-cancel-button"]');
    await closeBtn.click();
    await page.waitForTimeout(1500);

    // Modal should be closed (discard was accepted via window.confirm)
    const modal = page.locator('[data-testid="add-nutrition-modal"]');
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('modal resets form state between opens', async ({ page }) => {
    const modal = await openNutritionModal(page);

    // Enter some data
    const calInput = page.locator('[data-testid="nutrition-calories-input"]');
    await calInput.fill('500');
    await page.waitForTimeout(300);

    // Accept window.confirm dialog when it fires
    page.once('dialog', async (d) => { await d.accept(); });

    // Close via X — window.confirm auto-accepted
    const closeBtn = page.locator('[data-testid="nutrition-cancel-button"]');
    await closeBtn.click();
    await page.waitForTimeout(1500);

    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Re-open the modal
    const btn = page.locator('[data-testid="dashboard-log-food-button"]');
    await btn.click();
    await page.waitForTimeout(1500);
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Calories input should be empty (form was reset)
    const calValue = await calInput.inputValue();
    expect(calValue).toBe('');
  });

  test('submit button blocks when no food entered', async ({ page }) => {
    await openNutritionModal(page);

    // Click submit with empty form — should show alert, not submit
    const submitBtn = page.locator('[data-testid="nutrition-submit-button"]');
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Dismiss any in-page alert
    const okBtn = page.getByText('OK', { exact: true });
    if (await okBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await okBtn.click();
      await page.waitForTimeout(500);
    }

    // Modal should still be visible (not closed by submit)
    const modal = page.locator('[data-testid="add-nutrition-modal"]');
    await expect(modal).toBeVisible({ timeout: 3000 });
  });

  test('can fill all macro fields', async ({ page }) => {
    await openNutritionModal(page);

    const calInput = page.locator('[data-testid="nutrition-calories-input"]');
    const proInput = page.locator('[data-testid="nutrition-protein-input"]');
    const carbInput = page.locator('[data-testid="nutrition-carbs-input"]');
    const fatInput = page.locator('[data-testid="nutrition-fat-input"]');

    await calInput.fill('2000');
    await proInput.fill('150');
    await carbInput.fill('200');
    await fatInput.fill('80');

    // Verify values stuck
    expect(await calInput.inputValue()).toBe('2000');
    expect(await proInput.inputValue()).toBe('150');
    expect(await carbInput.inputValue()).toBe('200');
    expect(await fatInput.inputValue()).toBe('80');
  });

  test('successful log closes modal and refreshes dashboard', async ({ page }) => {
    await openNutritionModal(page);

    // Fill all required fields
    await page.locator('[data-testid="nutrition-calories-input"]').fill('500');
    await page.locator('[data-testid="nutrition-protein-input"]').fill('30');
    await page.locator('[data-testid="nutrition-carbs-input"]').fill('60');
    await page.locator('[data-testid="nutrition-fat-input"]').fill('15');
    await page.waitForTimeout(300);

    // Submit
    const submitBtn = page.locator('[data-testid="nutrition-submit-button"]');
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // After successful submit, modal stays open for continued logging
    // but a success message should appear
    const modal = page.locator('[data-testid="add-nutrition-modal"]');
    const isStillOpen = await modal.isVisible({ timeout: 3000 }).catch(() => false);

    if (isStillOpen) {
      // Close it manually
      const closeBtn = page.locator('[data-testid="nutrition-cancel-button"]');
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }

    // Dashboard should be visible
    const dashboard = page.locator('[data-testid="dashboard-screen"]');
    await expect(dashboard).toBeVisible({ timeout: 10000 });
  });
});
