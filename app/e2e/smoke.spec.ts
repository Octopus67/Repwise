import { test, expect } from '@playwright/test';

test('app loads', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Take a screenshot to see what's on screen
  await page.screenshot({ path: 'e2e/screenshots/smoke.png', fullPage: true });
  
  // Check that something rendered
  const body = page.locator('body');
  await expect(body).toBeVisible();
  
  // Log what's visible
  const text = await page.textContent('body');
  console.log('Page text (first 500 chars):', text?.slice(0, 500));
});
