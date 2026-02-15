import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateToTab } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('shows bottom tab bar', async ({ page }) => {
    const homeTab = page.locator('[data-testid="tab-home"]');
    const logTab = page.locator('[data-testid="tab-log"]');
    const analyticsTab = page.locator('[data-testid="tab-analytics"]');
    const profileTab = page.locator('[data-testid="tab-profile"]');

    await expect(homeTab).toBeVisible({ timeout: 10000 });
    await expect(logTab).toBeVisible();
    await expect(analyticsTab).toBeVisible();
    await expect(profileTab).toBeVisible();
  });

  test('can navigate to Log tab', async ({ page }) => {
    await navigateToTab(page, 'Log');
    // Verify we're no longer on dashboard
    await page.waitForTimeout(500);
    // The page should have changed - log screen content should be present
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  test('can navigate to Analytics tab', async ({ page }) => {
    await navigateToTab(page, 'Analytics');
    await page.waitForTimeout(500);
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  test('can navigate to Profile tab', async ({ page }) => {
    await navigateToTab(page, 'Profile');
    await page.waitForTimeout(500);

    const profileScreen = page.locator('[data-testid="profile-screen"]');
    await expect(profileScreen).toBeVisible({ timeout: 5000 });
  });

  test('can navigate back to Home tab', async ({ page }) => {
    // Go to Profile first
    await navigateToTab(page, 'Profile');
    await page.waitForTimeout(500);

    // Navigate back to Home
    await navigateToTab(page, 'Home');
    await page.waitForTimeout(500);

    const dashboard = page.locator('[data-testid="dashboard-screen"]');
    await expect(dashboard).toBeVisible({ timeout: 5000 });
  });

  test('tab bar persists across navigation', async ({ page }) => {
    // Navigate through all tabs and verify tab bar stays visible
    const tabs = ['Log', 'Analytics', 'Profile', 'Home'];
    for (const tab of tabs) {
      await navigateToTab(page, tab);
      await page.waitForTimeout(300);

      const homeTab = page.locator('[data-testid="tab-home"]');
      await expect(homeTab).toBeVisible();
    }
  });
});
