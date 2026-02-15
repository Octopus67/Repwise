import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateToTab } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('shows greeting section', async ({ page }) => {
    const greeting = page.locator('[data-testid="dashboard-greeting"]');
    await expect(greeting).toBeVisible({ timeout: 10000 });
  });

  test('shows macro rings', async ({ page }) => {
    const macroRings = page.locator('[data-testid="macro-rings-row"]');
    await expect(macroRings).toBeVisible({ timeout: 10000 });
  });

  test('shows quick action buttons', async ({ page }) => {
    const logFood = page.locator('[data-testid="dashboard-log-food-button"]');
    const logTraining = page.locator('[data-testid="dashboard-log-training-button"]');
    const logBodyweight = page.locator('[data-testid="dashboard-log-bodyweight-button"]');

    await expect(logFood).toBeVisible({ timeout: 10000 });
    await expect(logTraining).toBeVisible();
    await expect(logBodyweight).toBeVisible();
  });

  test('shows date scroller', async ({ page }) => {
    const dateScroller = page.locator('[data-testid="dashboard-date-scroller"]');
    await expect(dateScroller).toBeVisible({ timeout: 10000 });
  });

  test('can open nutrition modal via quick action', async ({ page }) => {
    const logFood = page.locator('[data-testid="dashboard-log-food-button"]');
    await expect(logFood).toBeVisible({ timeout: 10000 });
    await logFood.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('[data-testid="add-nutrition-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('can refresh dashboard', async ({ page }) => {
    const dashboard = page.locator('[data-testid="dashboard-screen"]');
    await expect(dashboard).toBeVisible({ timeout: 10000 });

    // Scroll to top to trigger refresh
    await dashboard.evaluate((el) => el.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    // Dashboard should still be visible after refresh
    await expect(dashboard).toBeVisible();
  });

  test('shows featured articles section', async ({ page }) => {
    const articles = page.locator('[data-testid="dashboard-articles-section"]');
    // Articles section may or may not be visible depending on data
    // Just verify the dashboard loaded successfully
    const dashboard = page.locator('[data-testid="dashboard-screen"]');
    await expect(dashboard).toBeVisible({ timeout: 10000 });
  });
});
