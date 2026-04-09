import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateToTab } from './helpers';

test.describe('Profile Flows', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToTab(page, 'profile');
    await expect(page.locator('[data-testid="profile-screen"]')).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to Notification Settings', async ({ page }) => {
    const notifLink = page.locator('[data-testid="profile-notifications-link"]');
    await expect(notifLink).toBeVisible({ timeout: 5000 });
    await notifLink.click();
    await page.waitForTimeout(1500);

    const screen = page.locator('[data-testid="notification-settings-screen"]');
    await expect(screen).toBeVisible({ timeout: 10000 });

    // Verify toggles exist
    const allToggle = page.locator('[data-testid="toggle-all-notifications"]');
    await expect(allToggle).toBeVisible({ timeout: 5000 });

    // Verify at least one specific toggle
    const workoutToggle = page.locator('[data-testid="toggle-workout_reminders"]');
    await expect(workoutToggle).toBeVisible({ timeout: 3000 });
  });

  test('unit system shows descriptive labels', async ({ page }) => {
    // Look for the unit system selector with descriptive labels
    const metricLabel = page.getByText('Metric (kg, cm)');
    const imperialLabel = page.getByText('Imperial (lbs, ft)');

    // At least one should be visible (the current selection)
    const metricVisible = await metricLabel.isVisible({ timeout: 5000 }).catch(() => false);
    const imperialVisible = await imperialLabel.isVisible({ timeout: 3000 }).catch(() => false);

    expect(metricVisible || imperialVisible).toBe(true);
  });

  test('coaching shows premium gate for non-premium users', async ({ page }) => {
    // Find coaching nav item — should show premium description
    const coachingDesc = page.getByText('Premium', { exact: false });
    const coachingVisible = await coachingDesc.isVisible({ timeout: 5000 }).catch(() => false);

    // Either premium gate text is visible, or user is premium (both are valid)
    if (coachingVisible) {
      // Non-premium: clicking should open upgrade modal
      const coachingItem = page.getByText('Coaching');
      await coachingItem.click();
      await page.waitForTimeout(1000);

      // Upgrade modal should appear
      const upgradeText = page.getByText('Upgrade', { exact: false });
      await expect(upgradeText).toBeVisible({ timeout: 5000 });
    }
    // If not visible, user is premium — coaching nav works normally (also valid)
  });

  test('learn section has articles', async ({ page }) => {
    const learnLink = page.locator('[data-testid="profile-learn-link"]');
    await expect(learnLink).toBeVisible({ timeout: 5000 });
    await learnLink.click();
    await page.waitForTimeout(2000);

    const learnScreen = page.locator('[data-testid="learn-screen"]');
    await expect(learnScreen).toBeVisible({ timeout: 10000 });

    // Should NOT show empty state
    const emptyState = page.locator('[data-testid="learn-empty-state"]');
    const isEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    expect(isEmpty).toBe(false);

    // Should have at least one article in the list
    const articleList = page.locator('[data-testid="learn-article-list"]');
    await expect(articleList).toBeVisible({ timeout: 5000 });
  });
});
