/**
 * Scenario 27 — Connectors settings page: list, per-tool toggle, archive.
 *
 * Ported from the web app's e2e suite. Covers the account-level connector
 * lifecycle UI at `/settings/connectors` WITHOUT live discovery: we seed a
 * connector row + one of its tool rows directly (the register-via-form path
 * does a live discovery call against the URL → manual doc).
 *
 *  1. Seed an `mcp_connectors` row + one enabled `mcp_connector_tools` row.
 *  2. Open /settings/connectors → the connector card lists it.
 *  3. Expand → toggle the tool off → the BE flips `enabled=false`.
 *  4. Delete (confirm-gated) → the card disappears + the row is archived.
 *
 * Desktop adaptations vs the web app: auth comes from the seed-token `page`
 * fixture (no login form); the card header is a `role="button"` whose
 * accessible name is exactly the connector's display name; and the destructive
 * action is a "Delete <name>" ConfirmButton → alertdialog "Delete" (the desktop
 * card has no separate "Archive…" button, though the handler archives — sets
 * status='archived'). The per-tool checkbox id (`#tool-toggle-<id>`) matches
 * the web app 1:1.
 */
import { test, expect } from '../fixtures';
import { psql } from '../helpers/db';
import { TEST_USER } from '../helpers/env';

test.describe.configure({ mode: 'serial' });

const CONNECTOR_ID = '27272727-2727-2727-2727-272727272727';
const TOOL_ID = '27000000-0000-0000-0000-0000000000aa';
const CONNECTOR_NAME = 'E2E Manage Connector';
const TOOL_API_NAME = 'mcp.e2e-manage.search';

test.describe('Scenario 27 — Manage an MCP connector', () => {
  test.beforeEach(() => {
    // Clean slate, then seed a connector + one enabled tool for the user.
    psql(`DELETE FROM mcp_connector_tools WHERE id = '${TOOL_ID}';`);
    psql(`DELETE FROM mcp_connectors WHERE id = '${CONNECTOR_ID}';`);
    psql(
      `INSERT INTO mcp_connectors (id, user_id, display_name, transport, config)
       VALUES ('${CONNECTOR_ID}',
               (SELECT id FROM users WHERE email = '${TEST_USER.email}'),
               '${CONNECTOR_NAME}', 'http',
               '{"url":"https://e2e.example.com/sse"}'::jsonb);`,
    );
    psql(
      `INSERT INTO mcp_connector_tools
         (id, user_id, mcp_connector_id, api_name, display_name, description, config, enabled)
       VALUES ('${TOOL_ID}',
               (SELECT id FROM users WHERE email = '${TEST_USER.email}'),
               '${CONNECTOR_ID}', '${TOOL_API_NAME}', 'search', 'Search',
               '{"upstream_name":"search"}'::jsonb, true);`,
    );
  });

  test('lists the connector, toggles a tool off, archives it', async ({ page }) => {
    await page.goto('/settings/connectors', { waitUntil: 'networkidle' });

    // ── Card is listed (header aria-label === display name, exact) ──
    const header = page.getByRole('button', { name: CONNECTOR_NAME, exact: true });
    await expect(header).toBeVisible();

    // ── Expand → toggle the tool off → BE flips enabled=false ──
    // Click the name text, not the header's geometric centre: the header row
    // nests action buttons (active-toggle / refresh / edit / delete) that
    // stopPropagation, so a centre click can land on one of them and never
    // toggle expand. The name span bubbles to the row's expand handler.
    await header.getByText(CONNECTOR_NAME, { exact: true }).click();
    const toolToggle = page.locator(`#tool-toggle-${TOOL_ID}`);
    await expect(toolToggle).toBeChecked();
    await toolToggle.click();

    await expect
      .poll(() => psql(`SELECT enabled FROM mcp_connector_tools WHERE id = '${TOOL_ID}';`))
      .toBe('f');

    // ── Delete (confirm-gated) → card gone + the row is removed ──
    // NOTE: the current BE hard-deletes the connector (route docstring:
    // "Hard-delete the connector. Its tools, every agent/flow binding, …"),
    // so unlike the web app's stale spec (which expected status='archived')
    // we assert the row is gone. Cascades drop its tools + bindings too.
    await page.getByRole('button', { name: `Delete ${CONNECTOR_NAME}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

    await expect(header).toHaveCount(0);
    await expect
      .poll(() => psql(`SELECT count(*) FROM mcp_connectors WHERE id = '${CONNECTOR_ID}';`))
      .toBe('0');
  });
});
