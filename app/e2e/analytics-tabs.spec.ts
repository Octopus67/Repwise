import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateToTab } from './helpers';

test.describe('Analytics Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToTab(page, 'Analytics');
  });

  test('analytics screen shows tab pills', async ({ page }) => {
    const analyticsScreen = page.locator('[data-testid="analytics-screen"]');
    await expect(analyticsScreen).toBeVisible({ timeout: 10000 });

    // Verify all 3 tab pills are visible
    const nutritionTab = page.locator('[data-testid="analytics-tab-nutrition"]');
    const trainingTab = page.locator('[data-testid="analytics-tab-training"]');
    const bodyTab = page.locator('[data-testid="analytics-tab-body"]');

    await expect(nutritionTab).toBeVisible({ timeout: 5000 });
    await expect(trainingTab).toBeVisible({ timeout: 5000 });
    await expect(bodyTab).toBeVisible({ timeout: 5000 });

    // Also verify the text content
    const nutritionText = page.getByText('Nutrition').first();
    const trainingText = page.getByText('Training').first();
    const bodyText = page.getByText('Body').first();

    await expect(nutritionText).toBeVisible({ timeout: 3000 });
    await expect(trainingText).toBeVisible({ timeout: 3000 });
    await expect(bodyText).toBeVisible({ timeout: 3000 });
  });

  test('can switch to training tab', async ({ page }) => {
    const trainingTab = page.locator('[data-testid="analytics-tab-training"]');
    await expect(trainingTab).toBeVisible({ timeout: 10000 });
    await trainingTab.click();
    await page.waitForTimeout(1000);

    // Training-specific content should appear (e.g., Training Volume section)
    const trainingContent = page.getByText(/Training Volume|Strength Progression|Muscle Volume/i).first();
    const isVisible = await trainingContent.isVisible({ timeout: 5000 }).catch(() => false);
    expect(isVisible).toBeTruthy();

    // Nutrition-specific content should NOT be visible
    const calorieChart = page.locator('[data-testid="analytics-calorie-chart"]');
    const calorieVisible = await calorieChart.isVisible({ timeout: 2000 }).catch(() => false);
    expect(calorieVisible).toBeFalsy();
  });

  test('can switch to body tab', async ({ page }) => {
    const bodyTab = page.locator('[data-testid="analytics-tab-body"]');
    await expect(bodyTab).toBeVisible({ timeout: 10000 });
    await bodyTab.click();
    await page.waitForTimeout(1000);

    // Body-specific content should appear (e.g., Bodyweight Trend section)
    const bodyContent = page.getByText(/Bodyweight Trend|Readiness Trend|Expenditure Trend/i).first();
    const isVisible = await bodyContent.isVisible({ timeout: 5000 }).catch(() => false);
    expect(isVisible).toBeTruthy();

    // Nutrition-specific content should NOT be visible
    const calorieChart = page.locator('[data-testid="analytics-calorie-chart"]');
    const calorieVisible = await calorieChart.isVisible({ timeout: 2000 }).catch(() => false);
    expect(calorieVisible).toBeFalsy();
  });

  test('time range selector visible on all tabs', async ({ page }) => {
    const timeRange = page.locator('[data-testid="analytics-time-range"]');

    // Visible on default (Nutrition) tab
    await expect(timeRange).toBeVisible({ timeout: 10000 });

    // Switch to Training tab
    const trainingTab = page.locator('[data-testid="analytics-tab-training"]');
    await trainingTab.click();
    await page.waitForTimeout(1000);
    await expect(timeRange).toBeVisible({ timeout: 5000 });

    // Switch to Body tab
    const bodyTab = page.locator('[data-testid="analytics-tab-body"]');
    await bodyTab.click();
    await page.waitForTimeout(1000);
    await expect(timeRange).toBeVisible({ timeout: 5000 });
  });
});
