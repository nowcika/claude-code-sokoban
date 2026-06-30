import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for "Claude Code Sokoban" E2E suite.
 * - Serves the single-file game via `python3 -m http.server 8765`.
 * - baseURL points at the local static server; index.html is loaded relatively.
 * - Traces + screenshots captured on failure for canvas debugging.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8765',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 8765',
    url: 'http://localhost:8765/index.html',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
