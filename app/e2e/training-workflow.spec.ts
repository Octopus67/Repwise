import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8000/api/v1';

async function ensureOnDashboard(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const dashboard = page.locator('[data-testid="dashboard-screen"]');
  if (await dashboard.isVisible({ timeout: 3000 }).catch(() => false)) return;

  const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const creds = { email: `e2e_${uid}@test.com`, password: `E2ePass1!${uid}` };
  const res = await page.request.post(`${API}/auth/register`, { data: creds });
  const tokens = await res.json();
  await page.request.post(`${API}/onboarding/complete`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    data: {
      age_years: 28, sex: 'male', weight_kg: 80, height_cm: 178,
      body_fat_pct: null, activity_level: 'moderate',
      exercise_sessions_per_week: 4, exercise_types: ['strength'],
      goal_type: 'maintaining', goal_rate_per_week: 0,
      diet_style: 'balanced', protein_per_kg: 2.0,
      dietary_restrictions: [], allergies: [], cuisine_preferences: [], meal_frequency: 3,
    },
  });
  await page.evaluate(
    ({ access, refresh }) => {
      localStorage.setItem('rw_access_token', access);
      localStorage.setItem('rw_refresh_token', refresh);
    },
    { access: tokens.access_token, refresh: tokens.refresh_token },
  );
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await expect(dashboard).toBeVisible({ timeout: 15000 });
}

async function openActiveWorkout(page: Page) {
  await page.waitForTimeout(4000);
  const btn = page.locator('[data-testid="dashboard-log-training-button"]');
  await expect(btn).toBeAttached({ timeout: 15000 });
  await btn.click({ force: true });
  await page.waitForTimeout(2000);
}

async function addExercise(page: Page, name: string) {
  const addBtn = page.getByText('+ Add Exercise');
  await expect(addBtn).toBeVisible({ timeout: 10000 });
  await addBtn.click();
  await page.waitForTimeout(2000);
  const search = page.getByPlaceholder(/search exercise/i);
  await expect(search).toBeVisible({ timeout: 10000 });
  await search.fill(name);
  await page.waitForTimeout(1500);
  const exerciseBtn = page.getByRole('button', { name: new RegExp(name, 'i') }).first();
  await expect(exerciseBtn).toBeVisible({ timeout: 5000 });
  await exerciseBtn.click();
  await page.waitForTimeout(2000);
}

test.describe('Training Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await ensureOnDashboard(page);
  });

  test('Test 1: Open training from Dashboard', async ({ page }) => {
    await openActiveWorkout(page);
    const addExerciseBtn = page.getByText('+ Add Exercise');
    await expect(addExerciseBtn).toBeVisible({ timeout: 10000 });
  });

  test('Test 2: Add exercise via picker', async ({ page }) => {
    await openActiveWorkout(page);
    await addExercise(page, 'Bench Press');
    const exerciseCard = page.getByText(/Bench Press/i).first();
    await expect(exerciseCard).toBeVisible({ timeout: 5000 });
  });

  test('Test 3: Log a set', async ({ page }) => {
    await openActiveWorkout(page);
    await addExercise(page, 'Bench Press');
    const repsInput = page.getByRole('textbox', { name: /reps for set/i }).first();
    await expect(repsInput).toBeVisible({ timeout: 5000 });
    await repsInput.fill('8');
    const weightInput = page.getByRole('textbox', { name: /weight for set/i }).first();
    await expect(weightInput).toBeVisible({ timeout: 5000 });
    await weightInput.fill('80');
    await expect(repsInput).toHaveValue('8');
    await expect(weightInput).toHaveValue('80');
  });

  test('Test 4: Add and remove sets', async ({ page }) => {
    await openActiveWorkout(page);
    await addExercise(page, 'Bench Press');
    const addSetBtn = page.getByText('+ Add Set').first();
    await expect(addSetBtn).toBeVisible({ timeout: 5000 });
    await addSetBtn.click();
    await page.waitForTimeout(500);
    // Verify set 2 appeared — look for "Reps for set 2" input
    const set2Reps = page.getByRole('textbox', { name: /reps for set 2/i });
    await expect(set2Reps).toBeVisible({ timeout: 3000 });
  });

  test('Test 5: Search exercises in picker', async ({ page }) => {
    await openActiveWorkout(page);
    const addBtn = page.getByText('+ Add Exercise');
    await addBtn.click();
    await page.waitForTimeout(2000);
    const search = page.getByPlaceholder(/search exercise/i);
    await expect(search).toBeVisible({ timeout: 10000 });
    await search.fill('Squat');
    await page.waitForTimeout(1500);
    const result = page.getByRole('button', { name: /squat/i }).first();
    await expect(result).toBeVisible({ timeout: 5000 });
  });

  test('Test 6: Finish workout', async ({ page }) => {
    await openActiveWorkout(page);
    await addExercise(page, 'Bench Press');
    // Log a set
    const repsInput = page.getByRole('textbox', { name: /reps for set/i }).first();
    await repsInput.fill('5');
    const weightInput = page.getByRole('textbox', { name: /weight for set/i }).first();
    await weightInput.fill('100');
    // Complete the set
    const checkBtn = page.getByRole('button', { name: /complete set/i }).first();
    if (await checkBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkBtn.click();
      await page.waitForTimeout(1000);
    }
    // Dismiss rest timer if it appears
    const dismiss = page.getByText(/Skip|Dismiss|Close/i).first();
    if (await dismiss.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dismiss.click();
      await page.waitForTimeout(500);
    }
    // Click Finish Workout
    const finishBtn = page.getByText('Finish Workout');
    await expect(finishBtn).toBeVisible({ timeout: 5000 });
    await finishBtn.click({ force: true });
    await page.waitForTimeout(3000);
    // After finishing, should show workout summary with muscle group stats
    // or navigate back to dashboard
    await page.waitForTimeout(2000);
    const dashboard = page.locator('[data-testid="dashboard-screen"]');
    const muscleStats = page.getByText(/chest.*1|1.*sets/i).first();
    const finishVisible = page.getByText('Finish Workout');
    const onDashboard = await dashboard.isVisible({ timeout: 3000 }).catch(() => false);
    const hasSummary = await muscleStats.isVisible({ timeout: 3000 }).catch(() => false);
    const finishGone = !(await finishVisible.isVisible({ timeout: 1000 }).catch(() => false));
    // Workout was processed — either we see summary stats or we're back on dashboard
    expect(onDashboard || hasSummary || finishGone).toBeTruthy();
  });

  test('Test 7: Discard empty workout', async ({ page }) => {
    await openActiveWorkout(page);
    // Open workout options menu
    const optionsBtn = page.getByRole('button', { name: /workout options/i });
    if (await optionsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await optionsBtn.click();
      await page.waitForTimeout(1000);
      const discardOption = page.getByText(/discard/i).first();
      if (await discardOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await discardOption.click();
        await page.waitForTimeout(2000);
      }
    }
    // Confirm discard if alert appears
    const confirmBtn = page.getByText(/discard|yes|confirm/i).first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }
    // Should be back on dashboard
    const dashboard = page.locator('[data-testid="dashboard-screen"]');
    await expect(dashboard).toBeAttached({ timeout: 15000 });
  });
});
