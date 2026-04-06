import { Page, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8000/api/v1';

/** Generate unique test credentials. */
function makeCredentials() {
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return { email: `e2e_${uid}@test.com`, password: `E2ePass1!${uid}` };
}

/** Wait for the app to load. */
export async function waitForApp(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
}

/**
 * Register + complete onboarding via API, then inject tokens into localStorage.
 * This gets the user straight to the dashboard without clicking through the wizard.
 */
export async function ensureLoggedIn(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Check if already on dashboard
  const dashboard = page.locator('[data-testid="dashboard-screen"]');
  if (await dashboard.isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }

  const creds = makeCredentials();

  // Register via API
  const regResp = await page.request.post(`${API_BASE}/auth/register`, {
    data: creds,
  });
  const regData = await regResp.json();
  const token = regData.access_token;

  // Complete onboarding via API
  await page.request.post(`${API_BASE}/onboarding/complete`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      age_years: 28, sex: 'male', weight_kg: 80, height_cm: 178,
      body_fat_pct: null, activity_level: 'moderate',
      exercise_sessions_per_week: 4, exercise_types: ['strength'],
      goal_type: 'maintaining', goal_rate_per_week: 0,
      diet_style: 'balanced', protein_per_kg: 2.0,
      dietary_restrictions: [], allergies: [],
      cuisine_preferences: [], meal_frequency: 3,
    },
  });

  // Inject tokens into localStorage so the app picks them up
  await page.evaluate(
    ({ access, refresh }) => {
      localStorage.setItem('rw_access_token', access);
      localStorage.setItem('rw_refresh_token', refresh);
    },
    { access: regData.access_token, refresh: regData.refresh_token },
  );

  // Reload to pick up the tokens
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Verify dashboard loaded
  await expect(dashboard).toBeVisible({ timeout: 15000 });
}

/** Navigate to a bottom tab by name. */
export async function navigateToTab(page: Page, tabName: string) {
  const tab = page.locator(`[data-testid="tab-${tabName.toLowerCase()}"]`);
  await expect(tab).toBeVisible({ timeout: 10000 });
  await tab.click();
  await page.waitForTimeout(1500);
}

/** Register a new user via the UI (for auth tests that test the registration flow). */
export async function registerUserViaUI(page: Page) {
  const creds = makeCredentials();
  const registerLink = page.locator('[data-testid="login-register-link"]');
  if (await registerLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await registerLink.click();
    await page.waitForTimeout(1000);
  }
  await page.locator('[data-testid="register-email-input"]').fill(creds.email);
  await page.locator('[data-testid="register-password-input"]').fill(creds.password);
  await page.locator('[data-testid="register-submit-button"]').click();
  await page.waitForTimeout(3000);
  return creds;
}
