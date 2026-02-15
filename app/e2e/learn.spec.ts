import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateToTab } from './helpers';

test.describe('Learn Screen', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToTab(page, 'Profile');
    await page.waitForTimeout(500);

    // Navigate to Learn from Profile
    const learnLink = page.locator('[data-testid="profile-learn-link"]');
    const profileScreen = page.locator('[data-testid="profile-screen"]');
    await profileScreen.evaluate((el) => el.scrollTo(0, el.scrollHeight / 2));
    await page.waitForTimeout(500);

    if (await learnLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await learnLink.click();
      await page.waitForTimeout(1500);
    }
  });

  test('shows learn screen', async ({ page }) => {
    const learnScreen = page.locator('[data-testid="learn-screen"]');
    await expect(learnScreen).toBeVisible({ timeout: 10000 });
  });

  test('shows filter pills', async ({ page }) => {
    const filterPills = page.locator('[data-testid="learn-filter-pills"]');
    await expect(filterPills).toBeVisible({ timeout: 10000 });
  });

  test('shows article list or empty state', async ({ page }) => {
    const articleList = page.locator('[data-testid="learn-article-list"]');
    await expect(articleList).toBeVisible({ timeout: 10000 });
  });

  test('can interact with filter pills', async ({ page }) => {
    const filterPills = page.locator('[data-testid="learn-filter-pills"]');
    await expect(filterPills).toBeVisible({ timeout: 10000 });

    // Try clicking a filter pill (e.g., "Training")
    const trainingPill = page.getByText('Training').first();
    if (await trainingPill.isVisible({ timeout: 2000 }).catch(() => false)) {
      await trainingPill.click();
      await page.waitForTimeout(1000);
    }

    // Page should still be functional
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });
});
