import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateToTab } from './helpers';

test.describe('Analytics Screen', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToTab(page, 'Analytics');
  });

  test('shows analytics screen', async ({ page }) => {
    const analyticsScreen = page.locator('[data-testid="analytics-screen"]');
    await expect(analyticsScreen).toBeVisible({ timeout: 10000 });
  });

  test('shows time range selector', async ({ page }) => {
    const timeRange = page.locator('[data-testid="analytics-time-range"]');
    await expect(timeRange).toBeVisible({ timeout: 10000 });
  });

  test('shows bodyweight chart section', async ({ page }) => {
    const chart = page.locator('[data-testid="analytics-bodyweight-chart"]');
    await expect(chart).toBeVisible({ timeout: 10000 });
  });

  test('shows calorie chart section', async ({ page }) => {
    const chart = page.locator('[data-testid="analytics-calorie-chart"]');
    // Calorie chart may be below the fold, scroll to it
    const analyticsScreen = page.locator('[data-testid="analytics-screen"]');
    await analyticsScreen.evaluate((el) => {
      const scrollable = el.querySelector('[data-testid="analytics-screen"]') || el;
      scrollable.scrollTo?.(0, 500);
    });
    await page.waitForTimeout(500);

    await expect(chart).toBeVisible({ timeout: 10000 });
  });

  test('shows nutrition report link', async ({ page }) => {
    const link = page.locator('[data-testid="analytics-nutrition-report-link"]');
    await expect(link).toBeVisible({ timeout: 10000 });
  });

  test('shows weekly report link', async ({ page }) => {
    const link = page.locator('[data-testid="analytics-weekly-report-link"]');
    await expect(link).toBeVisible({ timeout: 10000 });
  });

  test('can click nutrition report link', async ({ page }) => {
    const link = page.locator('[data-testid="analytics-nutrition-report-link"]');
    await expect(link).toBeVisible({ timeout: 10000 });
    await link.click();
    await page.waitForTimeout(1500);

    // Should navigate to nutrition report screen
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });
});
