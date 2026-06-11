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
  // Default per-test cap. Playwright's built-in default is 30s, which silently
  // overrode longer per-assertion waits (e.g. a 60s "reply" expect) in specs
  // that didn't set their own — a stale contradiction. 120s comfortably covers a
  // normal live reply (model-bound, measured ~1.3–14s); the few genuinely long
  // specs (multi-agent flows, create_pdf_long) raise it via test.setTimeout /
  // describe.configure. This is a correctness cap, not a perf guard (see
  // e2e/helpers/timeouts.ts).
  timeout: 120_000,
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
