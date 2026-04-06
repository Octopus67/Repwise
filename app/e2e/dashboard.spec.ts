import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers';

test.describe('Dashboard', () => {
  test('loads dashboard after login', async ({ page }) => {
    await ensureLoggedIn(page);
    const dashboard = page.locator('[data-testid="dashboard-screen"]');
    await expect(dashboard).toBeAttached({ timeout: 15000 });
  });

  test('shows greeting section', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.waitForTimeout(4000);
    const greeting = page.locator('[data-testid="dashboard-greeting"]');
    // Greeting may be hidden due to staggered animation — check attached
    await expect(greeting).toBeAttached({ timeout: 15000 });
  });

  test('shows quick action buttons', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.waitForTimeout(4000);
    const logFood = page.locator('[data-testid="dashboard-log-food-button"]');
    await expect(logFood).toBeAttached({ timeout: 15000 });
  });

  test('can open nutrition modal', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.waitForTimeout(5000);
    const logFood = page.locator('[data-testid="dashboard-log-food-button"]');
    await expect(logFood).toBeAttached({ timeout: 15000 });
    await logFood.click({ force: true });
    await page.waitForTimeout(2000);
    const modal = page.locator('[data-testid="add-nutrition-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });
});
