import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the pragna2 DESKTOP frontend, run in browser-fallback mode.
 *
 * The desktop app is a Tauri shell, but its React frontend also runs in a plain
 * browser (`pnpm dev` → Vite on :1420). In the browser the axios client uses
 * the default XHR adapter (not Tauri's native HTTP), and `me()` resolves the
 * session from a locally-decoded ID token — so a seeded token authenticates
 * with no Auth0 round-trip and no Tauri runtime. See README.md.
 *
 * Assumes the stack is already up (`pnpm run setup` first) — Playwright doesn't
 * manage the BE / FE / Postgres processes, just drives the browser.
 * `globalSetup` mints the seed token once; `fixtures.ts` injects it into
 * sessionStorage before every test's page scripts run.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false, // one shared backing DB; tests serialize for now
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_FE_URL ?? 'http://localhost:1420',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
