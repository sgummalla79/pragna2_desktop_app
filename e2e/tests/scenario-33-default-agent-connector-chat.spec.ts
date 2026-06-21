/**
 * Scenario 33 — Default chat agent responds with an MCP connector attached.
 *
 * End-to-end regression cover for #115 (BE root cause #114, fixed in
 * pragna2-api @ 1.0.11). #114 was a regression class that ONLY surfaces with a
 * real provider AND a real connector bound: attaching an MCP connector to the
 * chat agent put the connector's tool *schema* into the provider request, and a
 * tool name the provider rejected (e.g. dotted MCP names on Anthropic) made the
 * turn die on a 400 invalid-tool-name before any token streamed. Unit tests at
 * the McpToolHandler chokepoint guard the fix; this is the missing e2e that
 * exercises the original user-visible symptom — the agent must actually RESPOND.
 *
 *   1. Seed an `mcp_connectors` row + one enabled `mcp_connector_tools` row
 *      whose `api_name` is a dotted MCP-style name (the #114 trigger shape).
 *   2. Resolve the user's `is_default=true` chat agent.
 *   3. Attach the connector to the default agent via the agent editor UI
 *      (binding lands immediately in `agent_mcp_connectors`).
 *   4. Start a chat and send one benign turn (format-only, so the model answers
 *      directly rather than invoking the tool against the seeded fake URL).
 *   5. Assert the run is ACCEPTED and streams a non-empty reply — the precise
 *      inverse of #114 (Stop button appears = HTTP 200, not a 400; the assistant
 *      bubble streams; final text is non-empty).
 *
 * Model/provider-agnostic (STANDING RULE): this spec does NOT pin a provider.
 * The turn uses whatever model is seeded for the test user, and the assertion is
 * the provider-independent invariant "a bound connector does not break the run".
 * #114 was Anthropic-specific, so to reproduce THAT exact case, run with an
 * Anthropic model seeded + `E2E_ANTHROPIC_API_KEY` set (and optionally
 * `E2E_MODEL_LABEL` to target it) — no provider name is hardcoded here.
 *
 * Real-LLM-required: the turn is a live reply, so the spec self-skips without a
 * real provider key (same gate as scenario-01). The attach + DB assertions are
 * deterministic; only the reply needs the model.
 *
 * Desktop adaptations vs the web app: auth via the seed-token `page` fixture (no
 * login form); the composer is matched by placeholder; turns carry `data-role`;
 * the run-complete signal is the Stop button reverting to Send.
 */
import { test, expect } from '../fixtures';
import { psql, psqlRows } from '../helpers/db';
import { TEST_USER } from '../helpers/env';
import { TIMEOUTS } from '../helpers/timeouts';

test.describe.configure({ mode: 'serial' });

const HAS_REAL_KEY = Boolean(
  process.env.E2E_LLM_API_KEY ??
    process.env.E2E_ANTHROPIC_API_KEY ??
    process.env.E2E_OPENAI_API_KEY ??
    process.env.E2E_GOOGLE_API_KEY,
);

const CONNECTOR_ID = '33333333-3333-3333-3333-333333333333';
const TOOL_ID = '33000000-0000-0000-0000-0000000000aa';
const CONNECTOR_NAME = 'E2E Chat Connector';
// A dotted, MCP-style tool name — the shape that tripped #114's invalid
// tool-name on Anthropic before the McpToolHandler sanitised it.
const TOOL_API_NAME = 'mcp.e2e-chat.search';

test.describe('Scenario 33 — Default agent responds with a connector attached', () => {
  test.skip(
    !HAS_REAL_KEY,
    'requires a real LLM key (E2E_LLM_API_KEY or E2E_<PROVIDER>_API_KEY) — the turn is a live reply',
  );

  let defaultAgentName = '';

  /** Binding rows linking the seeded connector to the default agent. */
  function bindingCount(): string {
    return psql(
      `SELECT count(*) FROM agent_mcp_connectors amc
       JOIN agents a ON a.id = amc.agent_id
       JOIN users u ON u.id = a.user_id
       WHERE u.email = '${TEST_USER.email}'
         AND a.is_default = true
         AND amc.mcp_connector_id = '${CONNECTOR_ID}';`,
    );
  }

  test.beforeEach(async ({ page }) => {
    // Clean slate (delete the connector → cascades any binding + tool rows),
    // then seed the connector + one enabled tool for the user.
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

    // Resolve the seeded default chat agent (the new-chat default).
    const [, dname] = psqlRows(
      `SELECT a.id, a.display_name FROM agents a JOIN users u ON a.user_id = u.id
       WHERE u.email = '${TEST_USER.email}' AND a.is_default = true
         AND a.status <> 'archived' LIMIT 1`,
    )[0];
    defaultAgentName = dname;

    // Plain reply: un-expose slash flows so the default agent answers directly
    // instead of PROPOSING a leftover flow (the flow specs leave some exposed in
    // the shared serial DB — see scenario-01).
    psql('UPDATE flows SET exposed_as_slash = false WHERE exposed_as_slash = true;');

    await page.goto('/settings/agents', { waitUntil: 'networkidle' });
  });

  test.afterEach(() => {
    // Remove the connector (cascades the binding + tool) so the default agent
    // is left clean for the other serial specs.
    psql(`DELETE FROM mcp_connectors WHERE id = '${CONNECTOR_ID}';`);
  });

  test('attach a connector to the default agent, then the agent streams a non-empty reply', async ({
    page,
  }) => {
    test.setTimeout(120_000); // one live turn

    // ── Attach the connector to the DEFAULT agent via the editor ──
    await page.getByRole('button', { name: `Edit ${defaultAgentName}` }).click();
    await page.getByTestId('agent-connector-attach').click();
    await page.getByRole('option', { name: CONNECTOR_NAME }).click();

    // The binding lands immediately (its own POST endpoint), independent of Save.
    await expect.poll(bindingCount).toBe('1');

    // ── Start a chat with the (now connector-bound) default agent ──
    await page.goto('/chat', { waitUntil: 'networkidle' });

    const composer = page.getByPlaceholder(/ask .*anything|message the assistant|reply/i);
    await composer.click();
    // Format-only prompt → the agent answers directly; it has no reason to call
    // the seeded search tool (whose URL is a non-routable placeholder).
    await composer.fill('Reply with exactly the word READY and nothing else.');
    await page.keyboard.press('Enter');

    // ── User bubble appears immediately (FE optimistically commits) ──
    await expect(page.locator('[data-role="user"]').last()).toContainText(/READY/i, {
      timeout: TIMEOUTS.UI_COMMIT,
    });

    // ── The run is ACCEPTED — the Stop button replaces Send (HTTP 200, not a
    //    #114 400 invalid-tool-name). This is the key regression assertion. ──
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toBeVisible({ timeout: TIMEOUTS.RUN_ACCEPT });

    // ── A streaming assistant bubble appears ──
    const assistantBubble = page.locator('[data-role="assistant"]').last();
    await expect(assistantBubble).toBeVisible({ timeout: TIMEOUTS.FE_SETTLE });

    // ── Streaming finishes cleanly (Stop reverts to Send) — model time ──
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toHaveCount(0, { timeout: TIMEOUTS.CHAT_REPLY });

    // ── Non-empty reply: the agent actually responded with a connector bound. ──
    const finalText = (await assistantBubble.textContent()) ?? '';
    expect(finalText.length).toBeGreaterThan(0);
  });
});
