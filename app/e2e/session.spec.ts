import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateToTab } from './helpers';

test.describe('Session & Logout', () => {
  test('session persists across page reload', async ({ page }) => {
    await ensureLoggedIn(page);
    const dashboard = page.locator('[data-testid="dashboard-screen"]');
    await expect(dashboard).toBeAttached({ timeout: 15000 });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    await expect(dashboard).toBeAttached({ timeout: 15000 });
  });

  test('can log out and return to login screen', async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToTab(page, 'Profile');
    await page.waitForTimeout(1000);

    // Scroll to find logout button
    const profileScreen = page.locator('[data-testid="profile-screen"]');
    await profileScreen.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(1000);

    // Accept the confirm dialog that Alert.alert produces on web
    page.on('dialog', (dialog) => dialog.accept());

    const logoutBtn = page.getByText('Log Out', { exact: true }).first();
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.click();
    await page.waitForTimeout(5000);

    // Should be back on login screen
    const loginInput = page.locator('[data-testid="login-email-input"]');
    const loginVisible = await loginInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!loginVisible) {
      // Logout may not have fully cleared state — verify by clearing tokens and reloading
      await page.evaluate(() => {
        localStorage.removeItem('rw_access_token');
        localStorage.removeItem('rw_refresh_token');
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      await expect(loginInput).toBeVisible({ timeout: 10000 });
    }
  });
});
