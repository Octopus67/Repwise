import { test, expect } from '@playwright/test';

test('debug auth flow', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // What's on screen?
  const bodyText = await page.textContent('body');
  console.log('INITIAL:', bodyText?.slice(0, 300));

  // Try registering via API
  const email = `debug_${Date.now()}@test.com`;
  try {
    const res = await page.request.post('http://localhost:8000/api/v1/auth/register', {
      data: { email, password: 'TestPass123!', name: 'Debug' },
    });
    console.log('Register status:', res.status());
    const body = await res.json().catch(() => res.text());
    console.log('Register response:', JSON.stringify(body).slice(0, 300));
  } catch (e: any) {
    console.log('Register error:', e.message);
  }

  // Try the UI registration
  const regLink = page.getByText('Register', { exact: false });
  if (await regLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Register link visible, clicking...');
    await regLink.click();
    await page.waitForTimeout(2000);
    const bodyText2 = await page.textContent('body');
    console.log('AFTER REGISTER CLICK:', bodyText2?.slice(0, 300));
  }
});
