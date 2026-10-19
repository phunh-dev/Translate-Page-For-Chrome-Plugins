import { defineConfig } from '@playwright/test';

// End-to-end tests load the built extension (.output/chrome-mv3) into Playwright's
// Chromium (branded Chrome ignores --load-extension). Run with `pnpm test:e2e`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
});
