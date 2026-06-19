/**
 * Scenario 31 — In-chat agent switch (multiple switches + per-turn attribution).
 *
 * Exercises the desktop agent-switcher (#147): a user changes the active
 * standalone agent mid-conversation, and the next turn is answered by the new
 * agent over the SAME thread. Verifies, across MULTIPLE switches:
 *   - a new chat opens on the `is_default=true` agent (picker label + seeded
 *     `conversations.agent_id`);
 *   - switching the picker PATCHes `conversations.agent_id` (asserted against the
 *     DB — deterministic, no live-model dependency for the "switch worked" part);
 *   - after a reload, each assistant turn shows the persona that produced it
 *     (`AgentBadge`), so a mixed-agent transcript stays correctly attributed and
 *     a switch does NOT re-label past turns.
 *
 * Real-LLM-required: each turn is a live reply, so the spec self-skips without a
 * real provider key (same gate as scenario-01). The switch + DB assertions are
 * deterministic; only the replies need the model.
 *
 * Model/provider-agnostic: uses whatever model is seeded for the test user — the
 * agent (persona) is what's switched here, not the model.
 */
import { test, expect } from '../fixtures';
import { psql, psqlRows } from '../helpers/db';
import { TIMEOUTS } from '../helpers/timeouts';

const HAS_REAL_KEY = Boolean(
  process.env.E2E_LLM_API_KEY ??
    process.env.E2E_ANTHROPIC_API_KEY ??
    process.env.E2E_OPENAI_API_KEY ??
    process.env.E2E_GOOGLE_API_KEY,
);

const EMAIL = process.env.E2E_TEST_EMAIL ?? 'test_user@example.com';
/** A second, non-default active agent seeded for this spec to switch to. */
const BRAVO_API = 'e2e-switch-bravo';
const BRAVO_NAME = 'Bravo Agent';

test.describe('Scenario 31 — In-chat agent switch', () => {
  test.skip(
    !HAS_REAL_KEY,
    'requires a real LLM key (E2E_LLM_API_KEY or E2E_<PROVIDER>_API_KEY) — each turn is a live reply',
  );

  let defaultAgentId = '';
  let defaultName = '';
  let bravoAgentId = '';

  test.beforeEach(async ({ page }) => {
    // Plain replies: un-expose slash flows so the agent answers directly (the
    // flow specs leave some exposed in the shared serial DB — see scenario-01).
    psql(`UPDATE flows SET exposed_as_slash = false WHERE exposed_as_slash = true;`);

    // Resolve the seeded default agent (the new-chat default).
    const [did, dname] = psqlRows(
      `SELECT a.id, a.display_name FROM agents a JOIN users u ON a.user_id=u.id
       WHERE u.email='${EMAIL}' AND a.is_default=true AND a.status<>'archived' LIMIT 1`,
    )[0];
    defaultAgentId = did;
    defaultName = dname;

    // Idempotently seed a second active agent to switch to (re-activate if a
    // prior run archived it). No model is needed — the agent supplies the
    // persona; the conversation's model answers.
    psql(
      `INSERT INTO agents (id,user_id,api_name,display_name,system_prompt,tools,is_default,status,metadata)
       SELECT gen_random_uuid(), u.id, '${BRAVO_API}', '${BRAVO_NAME}',
              'You are a helpful assistant.', '[]'::jsonb, false, 'active', '{}'::jsonb
       FROM users u WHERE u.email='${EMAIL}'
       AND NOT EXISTS (
         SELECT 1 FROM agents a2 JOIN users u2 ON a2.user_id=u2.id
         WHERE u2.email='${EMAIL}' AND a2.api_name='${BRAVO_API}'
       );`,
    );
    psql(
      `UPDATE agents a SET status='active', display_name='${BRAVO_NAME}'
       FROM users u WHERE a.user_id=u.id AND u.email='${EMAIL}' AND a.api_name='${BRAVO_API}';`,
    );
    bravoAgentId = psql(
      `SELECT a.id FROM agents a JOIN users u ON a.user_id=u.id
       WHERE u.email='${EMAIL}' AND a.api_name='${BRAVO_API}';`,
    ).trim();

    await page.goto('/chat', { waitUntil: 'networkidle' });
  });

  test.afterEach(() => {
    // Archive (don't delete — conversations/messages reference it) so the extra
    // agent doesn't pollute other specs' active-agent lists.
    psql(
      `UPDATE agents a SET status='archived'
       FROM users u WHERE a.user_id=u.id AND u.email='${EMAIL}' AND a.api_name='${BRAVO_API}';`,
    );
  });

  test('multiple mid-chat switches route the next turn + per-turn attribution survives reload', async ({
    page,
  }) => {
    test.setTimeout(180_000); // three live turns + a reload

    const composer = () =>
      page.getByPlaceholder(/ask .*anything|message the assistant|reply/i);
    const picker = page.getByLabel('Switch agent');
    const agentIdOf = (convId: string) =>
      psql(`SELECT agent_id FROM conversations WHERE id='${convId}';`).trim();

    /** Send one turn and wait for the run to finish (Stop reverts to Send). */
    const sendTurn = async (text: string): Promise<void> => {
      await composer().click();
      await composer().fill(text);
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('button', { name: /stop generating/i }),
      ).toHaveCount(0, { timeout: TIMEOUTS.CHAT_REPLY });
    };

    /** Switch the active agent via the composer picker (idle only). */
    const switchTo = async (name: string): Promise<void> => {
      await expect(picker).toBeEnabled();
      await picker.click();
      await page.getByRole('option', { name }).click();
      await expect(picker).toContainText(name, { timeout: TIMEOUTS.UI_COMMIT });
    };

    // Prompts are deliberately format-only (not knowledge/research questions):
    // the shared test DB has flows bound as `propose_flow_*` tools, and a
    // research-shaped question makes the model emit a flow-proposal tool call
    // with no tool response — which then 400s the NEXT turn on OpenAI (a BE
    // history bug, tracked separately). A "reply with X" instruction maps to no
    // flow, so the agent just answers and the switch/attribution is exercised
    // cleanly regardless of which flows other specs seeded.

    // ── Turn 1: a new chat opens on the DEFAULT agent ──
    await sendTurn('Reply with exactly the word ALPHA and nothing else.');
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}/, { timeout: TIMEOUTS.NAV });
    const convId = page.url().split('/chat/')[1];
    await expect(picker).toContainText(defaultName, { timeout: TIMEOUTS.FE_SETTLE });
    expect(agentIdOf(convId)).toBe(defaultAgentId); // seeded from is_default

    // ── Switch to Bravo → PATCH persists to the conversation row ──
    await switchTo(BRAVO_NAME);
    await expect
      .poll(() => agentIdOf(convId), { timeout: TIMEOUTS.UI_COMMIT })
      .toBe(bravoAgentId);

    // ── Turn 2: answered by Bravo over the same thread ──
    await sendTurn('Reply with exactly the word BETA and nothing else.');

    // ── Switch back to the default → row updates again (multiple switches) ──
    await switchTo(defaultName);
    await expect
      .poll(() => agentIdOf(convId), { timeout: TIMEOUTS.UI_COMMIT })
      .toBe(defaultAgentId);

    // ── Turn 3: answered by the default again ──
    await sendTurn('Reply with exactly the word GAMMA and nothing else.');

    // ── Reload → the mixed-agent transcript is correctly attributed per turn ──
    // (each assistant bubble shows the persona that produced it; a later switch
    // must NOT re-label earlier turns).
    await page.reload({ waitUntil: 'networkidle' });
    const badges = page.getByTestId('agent-badge');
    await expect(badges).toHaveCount(3, { timeout: TIMEOUTS.FE_SETTLE });
    await expect(badges.nth(0)).toHaveText(defaultName);
    await expect(badges.nth(1)).toHaveText(BRAVO_NAME);
    await expect(badges.nth(2)).toHaveText(defaultName);
  });
});
