/**
 * Scenario 32 — Local MCP servers (Developer) settings, browser-mode UI slice.
 *
 * The local-servers page lets a user author CLIENT-DELEGATED stdio MCP servers as
 * JSON. Browser-fallback e2e has NO Tauri runtime, so it CANNOT spawn a stdio
 * server — `mcpStdio.*` throws `NotInTauriError`. Real discovery + registration
 * is desktop-only and is covered by `LocalServersView.test.tsx` (unit) and the
 * manual #158 smoke (`docs/MANUAL_TEST_SCENARIOS.md` M11).
 *
 * What IS automatable here, and what this spec asserts:
 *   - the page RENDERS SAFELY in browser mode (no CF-011 blank-page crash — the
 *     view calls Tauri-only `mcpStdio` APIs, which must stay guarded);
 *   - JSON config validation (invalid JSON → inline `role="alert"` format error);
 *   - the desktop-only guard surfaces on Save (NotInTauriError → friendly notice).
 *
 * Live discovery/registration is deferred to tauri-driver / pragna2-tracker TD-028.
 */
import { test, expect } from '../fixtures';

const VALID_CONFIG = JSON.stringify(
  { mcpServers: { mock: { command: 'node', args: ['server.mjs'], env: {} } } },
  null,
  2,
);

test.describe('Scenario 32 — Local MCP servers settings (browser-mode UI)', () => {
  test('renders, validates JSON, and shows the desktop-only guard on save', async ({ page }) => {
    await page.goto('/settings/local-servers', { waitUntil: 'networkidle' });

    // (1) Renders safely in browser mode — no blank page (CF-011 regression guard).
    await expect(page.getByRole('heading', { name: 'Developer' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Configured servers' })).toBeVisible();

    // Open the editor panel (the "Config" button), which opens on the Tree tab,
    // then switch to the JSON "Edit" tab to reveal the raw config textarea.
    await page.getByRole('button', { name: 'Config', exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = page.getByLabel('Local MCP servers config (JSON)');
    await expect(editor).toBeVisible();
    const save = page.getByRole('button', { name: 'Save' });

    // (2) Valid config → consent confirm → Save → NotInTauriError → desktop-only
    // notice. `fill` does not blur, so `formatError` stays null and Save is enabled;
    // validation runs inside `handleSave`. Done first so no prior format error
    // disables Save.
    page.once('dialog', (dialog) => dialog.accept()); // the window.confirm consent gate
    await editor.fill(VALID_CONFIG);
    await save.click();
    await expect(
      page.getByText('Local MCP servers are only available in the desktop app.'),
    ).toBeVisible();

    // (3) Invalid JSON → Save runs validation → inline `role="alert"` format error
    // (the desktop-only notice above only set `error`, not `formatError`, so Save
    // is still enabled here).
    await editor.fill('{ not valid json');
    await save.click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
