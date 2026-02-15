import { test, expect } from '@playwright/test';

test('app loads and renders', async ({ page }) => {
  await page.goto('/');
  // Wait for the Expo web app to hydrate
  await page.waitForLoadState('networkidle');
  // Verify something rendered (adjust selector to match your app)
  await expect(page.locator('body')).not.toBeEmpty();
});
