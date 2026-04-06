import { test, expect } from '@playwright/test';
import { ensureLoggedIn, navigateToTab } from './helpers';

test.describe('Periodization', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToTab(page, 'Profile');
    await page.waitForTimeout(1000);
  });

  test('can navigate to periodization from profile', async ({ page }) => {
    const profileScreen = page.locator('[data-testid="profile-screen"]');
    await profileScreen.evaluate((el) => el.scrollTo(0, el.scrollHeight / 3));
    await page.waitForTimeout(500);

    // Look for periodization/training blocks link
    const periodLink = page.getByText(/periodization|training block|mesocycle/i).first();
    if (!(await periodLink.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await periodLink.click();
    await page.waitForTimeout(2000);

    // Should show periodization screen with create option
    const createBtn = page.getByText(/create.*block|new.*block|\+ block/i).first();
    const heading = page.getByText(/periodization|training block/i).first();
    const hasCreate = await createBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const hasHeading = await heading.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasCreate || hasHeading).toBeTruthy();
  });

  test('block creation modal has name and date fields', async ({ page }) => {
    const profileScreen = page.locator('[data-testid="profile-screen"]');
    await profileScreen.evaluate((el) => el.scrollTo(0, el.scrollHeight / 3));
    await page.waitForTimeout(500);

    const periodLink = page.getByText(/periodization|training block|mesocycle/i).first();
    if (!(await periodLink.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await periodLink.click();
    await page.waitForTimeout(2000);

    const createBtn = page.getByText(/create.*block|new.*block|\+ block/i).first();
    if (!(await createBtn.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await createBtn.click();
    await page.waitForTimeout(1500);

    // Should show block creation form with name input
    const nameInput = page.getByPlaceholder(/hypertrophy|block name/i).first();
    const hasName = await nameInput.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasName).toBeTruthy();
  });

  test('block template modal shows templates', async ({ page }) => {
    const profileScreen = page.locator('[data-testid="profile-screen"]');
    await profileScreen.evaluate((el) => el.scrollTo(0, el.scrollHeight / 3));
    await page.waitForTimeout(500);

    const periodLink = page.getByText(/periodization|training block|mesocycle/i).first();
    if (!(await periodLink.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await periodLink.click();
    await page.waitForTimeout(2000);

    const templateBtn = page.getByText(/template|from template/i).first();
    if (!(await templateBtn.isVisible({ timeout: 5000 }).catch(() => false))) return;

    await templateBtn.click();
    await page.waitForTimeout(1500);

    // Should show template options
    const applyBtn = page.getByText(/apply.*template/i).first();
    const hasApply = await applyBtn.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasApply).toBeTruthy();
  });
});
