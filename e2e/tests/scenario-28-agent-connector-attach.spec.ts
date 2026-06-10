/**
 * Scenario 28 — Attach an MCP connector to a standalone agent.
 *
 * Ported from the web app. Covers the agent↔connector binding UI
 * (`AgentConnectorsSection`, edit-mode only) WITHOUT live discovery: seed an
 * agent + a connector, then attach/detach through the agent editor.
 *
 *  1. Seed an `agents` row + an `mcp_connectors` row for the user.
 *  2. /settings/agents → Edit the agent → the "MCP connectors" section shows.
 *  3. Attach the connector from the picker → a row lands in
 *     `agent_mcp_connectors`.
 *  4. Detach (confirm-gated) → the binding row is gone.
 *
 * Bindings apply immediately (their own endpoints), independent of the form's
 * Save — so we assert the DB directly without saving the agent.
 *
 * Desktop adaptation: auth via the seed-token `page` fixture (no login form);
 * the section testids (`agent-connector-attach`) + the "Detach" ConfirmButton
 * match the web app 1:1.
 */
import { test, expect } from '../fixtures';
import { psql } from '../helpers/db';
import { TEST_USER } from '../helpers/env';

test.describe.configure({ mode: 'serial' });

const CONNECTOR_ID = '28282828-2828-2828-2828-282828282828';
const CONNECTOR_NAME = 'E2E Attach Connector';
const AGENT_API_NAME = 'e2e-attach-agent';
const AGENT_NAME = 'E2E Attach Agent';

function bindingCount(): string {
  return psql(
    `SELECT count(*) FROM agent_mcp_connectors amc
     JOIN agents a ON a.id = amc.agent_id
     WHERE a.api_name = '${AGENT_API_NAME}'
       AND amc.mcp_connector_id = '${CONNECTOR_ID}';`,
  );
}

test.describe('Scenario 28 — Attach a connector to an agent', () => {
  test.beforeEach(() => {
    // Clean slate (deleting the agent cascades its bindings), then seed both.
    psql(`DELETE FROM agents WHERE api_name = '${AGENT_API_NAME}';`);
    psql(`DELETE FROM mcp_connectors WHERE id = '${CONNECTOR_ID}';`);
    psql(
      `INSERT INTO mcp_connectors (id, user_id, display_name, transport, config)
       VALUES ('${CONNECTOR_ID}',
               (SELECT id FROM users WHERE email = '${TEST_USER.email}'),
               '${CONNECTOR_NAME}', 'http',
               '{"url":"https://e2e.example.com/sse"}'::jsonb);`,
    );
    psql(
      `INSERT INTO agents (id, user_id, api_name, display_name, system_prompt, status)
       VALUES (gen_random_uuid(),
               (SELECT id FROM users WHERE email = '${TEST_USER.email}'),
               '${AGENT_API_NAME}', '${AGENT_NAME}', 'You help.', 'active');`,
    );
  });

  test('attach via the agent editor, then detach', async ({ page }) => {
    await page.goto('/settings/agents', { waitUntil: 'networkidle' });

    // ── Open the agent editor ──
    await page.getByRole('button', { name: `Edit ${AGENT_NAME}` }).click();

    // ── Attach the connector from the picker (Radix Select) ──
    await page.getByTestId('agent-connector-attach').click();
    await page.getByRole('option', { name: CONNECTOR_NAME }).click();

    // The binding lands immediately (its own POST endpoint).
    await expect.poll(bindingCount).toBe('1');
    await expect(page.getByText(CONNECTOR_NAME)).toBeVisible();

    // ── Detach (confirm-gated) → binding removed ──
    await page.getByRole('button', { name: 'Detach' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Detach' }).click();

    await expect.poll(bindingCount).toBe('0');
  });
});
