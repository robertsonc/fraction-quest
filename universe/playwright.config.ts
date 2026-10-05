import { defineConfig, devices } from '@playwright/test';

/** A preinstalled Chromium can be used instead of a download (PW_CHROMIUM_PATH=/opt/pw-browsers/chromium). */
const exe = process.env['PW_CHROMIUM_PATH'];
const launchOptions = exe ? { executablePath: exe } : {};

/** iPad landscape first (the main device), then a laptop. Served from the production build so the CSP and the
 *  service worker are exercised the way Cloudflare Pages serves them. */
export default defineConfig({
  testDir: 'test/e2e',
  timeout: 90000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/world/',
    trace: 'retain-on-failure',
    launchOptions,
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/world/',
    reuseExistingServer: true,
    timeout: 60000,
  },
  projects: [
    { name: 'ipad-1180', use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 }, hasTouch: true } },
    { name: 'ipad-1366', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 1024 }, hasTouch: true } },
    { name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
