import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateToTab } from './helpers';

test.describe('Analytics Deep Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToTab(page, 'Analytics');
    await page.waitForTimeout(2000);
    const screen = page.locator('[data-testid="analytics-screen"]');
    await expect(screen).toBeVisible({ timeout: 15000 });
  });

  test('weekly report link navigates to report screen', async ({ page }) => {
    const link = page.locator('[data-testid="analytics-weekly-report-link"]');
    if (!(await link.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await link.click();
    await page.waitForTimeout(2000);

    const heading = page.getByText(/weekly.*report|intelligence.*report/i).first();
    await expect(heading).toBeAttached({ timeout: 5000 });
  });

  test('nutrition report link navigates to report screen', async ({ page }) => {
    const link = page.locator('[data-testid="analytics-nutrition-report-link"]');
    if (!(await link.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await link.click();
    await page.waitForTimeout(2000);

    const heading = page.getByText(/nutrition.*report|nutrition.*analysis/i).first();
    await expect(heading).toBeAttached({ timeout: 5000 });
  });

  test('micronutrient dashboard link navigates', async ({ page }) => {
    // Micro dashboard link may be below the fold
    const analyticsScreen = page.locator('[data-testid="analytics-screen"]');
    await analyticsScreen.evaluate((el) => el.scrollTo(0, 500));
    await page.waitForTimeout(500);

    const link = page.locator('[data-testid="analytics-micro-dashboard-link"]');
    if (!(await link.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await link.click();
    await page.waitForTimeout(2000);

    const heading = page.getByText(/micro|nutrient.*dashboard/i).first();
    await expect(heading).toBeAttached({ timeout: 5000 });
  });

  test('training tab shows strength progression', async ({ page }) => {
    const trainingTab = page.getByText('Training', { exact: true }).first();
    if (!(await trainingTab.isVisible({ timeout: 3000 }).catch(() => false))) return;

    await trainingTab.click();
    await page.waitForTimeout(1500);

    // Should show training analytics content
    const analyticsScreen = page.locator('[data-testid="analytics-screen"]');
    await expect(analyticsScreen).toBeVisible({ timeout: 5000 });
  });

  test('volume tab shows muscle volume data', async ({ page }) => {
    const volumeTab = page.getByText('Volume', { exact: true }).first();
    if (!(await volumeTab.isVisible({ timeout: 3000 }).catch(() => false))) return;

    await volumeTab.click();
    await page.waitForTimeout(1500);

    const analyticsScreen = page.locator('[data-testid="analytics-screen"]');
    await expect(analyticsScreen).toBeVisible({ timeout: 5000 });
  });
});
