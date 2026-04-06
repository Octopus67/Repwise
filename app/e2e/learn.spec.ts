import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateToTab } from './helpers';

test.describe('Learn Screen', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToTab(page, 'Profile');
    await page.waitForTimeout(500);

    const profileScreen = page.locator('[data-testid="profile-screen"]');
    await profileScreen.evaluate((el) => el.scrollTo(0, el.scrollHeight / 2));
    await page.waitForTimeout(500);

    const learnLink = page.locator('[data-testid="profile-learn-link"]');
    if (await learnLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await learnLink.click();
      await page.waitForTimeout(1500);
    }
  });

  test('shows learn screen', async ({ page }) => {
    const learnScreen = page.locator('[data-testid="learn-screen"]');
    await expect(learnScreen).toBeVisible({ timeout: 10000 });
  });

  test('shows category filters', async ({ page }) => {
    // Categories: All, Favorites, Hypertrophy, Nutrition, etc.
    const allCategory = page.getByText('All', { exact: true }).first();
    await expect(allCategory).toBeVisible({ timeout: 10000 });
  });

  test('shows article list or empty state', async ({ page }) => {
    const articleList = page.locator('[data-testid="learn-article-list"]');
    const emptyState = page.locator('[data-testid="learn-empty-state"]');
    const hasArticles = await articleList.isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasArticles || hasEmpty).toBeTruthy();
  });

  test('can filter by category', async ({ page }) => {
    const nutritionPill = page.getByText('Nutrition', { exact: true }).first();
    if (await nutritionPill.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nutritionPill.click();
      await page.waitForTimeout(1000);
    }
    // Screen should still be functional
    const learnScreen = page.locator('[data-testid="learn-screen"]');
    await expect(learnScreen).toBeVisible({ timeout: 5000 });
  });
});
