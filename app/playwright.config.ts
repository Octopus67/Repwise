import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 3,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : 'list',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    // Save error context on failure for debugging
    contextOptions: {
      recordVideo: process.env.CI ? { dir: path.join('test-results', 'videos') } : undefined,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'cd .. && source .venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 8000',
      url: 'http://localhost:8000/api/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npx expo start --web --port 8081',
      url: 'http://localhost:8081',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
