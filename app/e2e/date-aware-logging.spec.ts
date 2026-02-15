import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers';

test.describe('Date-Aware Logging & Dashboard Layout', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('quick actions visible above macro rings', async ({ page }) => {
    // Both elements should be visible
    const logFoodButton = page.locator('[data-testid="dashboard-log-food-button"]');
    const macroRings = page.locator('[data-testid="macro-rings-row"]');

    await expect(logFoodButton).toBeVisible({ timeout: 10000 });
    await expect(macroRings).toBeVisible({ timeout: 10000 });

    // Verify DOM order: quick actions should appear before macro rings
    // Get the bounding boxes to compare vertical positions
    const logFoodBox = await logFoodButton.boundingBox();
    const macroRingsBox = await macroRings.boundingBox();

    expect(logFoodBox).toBeTruthy();
    expect(macroRingsBox).toBeTruthy();

    if (logFoodBox && macroRingsBox) {
      // Quick actions (log food button) should be above macro rings (smaller Y value)
      expect(logFoodBox.y).toBeLessThan(macroRingsBox.y);
    }
  });

  test('dashboard shows see all articles link', async ({ page }) => {
    const dashboard = page.locator('[data-testid="dashboard-screen"]');
    await expect(dashboard).toBeVisible({ timeout: 10000 });

    // Scroll down to find the "See All" link in the featured articles section
    await dashboard.evaluate((el) => {
      el.scrollTo(0, el.scrollHeight);
    });
    await page.waitForTimeout(1000);

    const seeAllLink = page.getByText(/See All/i).first();
    const isVisible = await seeAllLink.isVisible({ timeout: 5000 }).catch(() => false);
    expect(isVisible).toBeTruthy();
  });
});
