import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // On CI, 'github' alone REPLACES the default html reporter, so
  // playwright-report/ is never written and the workflow's upload-artifact
  // step silently uploads nothing. Ask for both: inline annotations plus a
  // report to download when a run fails.
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    // 4322, not Astro's default 4321. `astro dev` and `astro preview` both
    // default to 4321, and `reuseExistingServer` below attaches to whatever
    // already holds the port — so with the background dev server CLAUDE.md
    // asks for, the suite silently tested the dev server instead of the build
    // and the dev toolbar's shadow DOM broke element counts (see
    // tests/e2e/global-setup.ts). A port of its own lets both run at once.
    baseURL: 'http://localhost:4322',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    // Tests the real static output, not the dev server.
    command: 'npm run build && npm run preview -- --port 4322',
    url: 'http://localhost:4322',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
