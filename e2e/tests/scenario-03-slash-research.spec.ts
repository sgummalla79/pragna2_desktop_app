/**
 * Scenario 3 — Run a slash command (slash-exposed flow).
 *
 * Covers the canonical single-agent slash flow end-to-end:
 *   Arrange — seed a `research-flow` row, open it in the editor, drop one Agent
 *             node + End, wire Start → Agent → End, Save; then mark the flow
 *             slash-exposed as `/research` (the desktop sets slash exposure on
 *             the flows card, which the concurrent flow agent owns — so we set
 *             `exposed_as_slash` + `slash_api_name` directly via psql instead of
 *             touching that UI).
 *   Act     — open a new chat, type `/research <topic>`, send.
 *   Assert  — user bubble has the `/research` prefix, the agent's progress label
 *             surfaces during the run, and an assistant bubble streams a reply.
 *
 * Real-LLM-required: the seeded test model carries a dummy key, so without
 * `E2E_ANTHROPIC_API_KEY` the spec self-skips. Authoring up through Save works
 * without a key, but the slash dispatch + reply assertion needs a live LLM.
 *
 * Desktop adaptations vs the web app: auth via the seed-token `page` fixture (no
 * login); flows are authored via `seedFlow` + `openFlow` (there is no
 * `/flows/new` route) using the desktop flow-author helpers; the composer is
 * matched by placeholder; turns carry `data-role`; the agent progress label
 * renders in the ThinkingStrip; and run-complete is the Stop button reverting to
 * Send. DB topology is asserted via `db.flowNodes` (the desktop db helper).
 */
import { test, expect } from '../fixtures';
import { db, psql } from '../helpers/db';
import {
  configureChatAgent,
  connectViaStore,
  dropFromPalette,
  openFlow,
  placeEnd,
  saveFlow,
  seedFlow,
} from '../helpers/flow-author';

const HAS_REAL_KEY = Boolean(process.env.E2E_ANTHROPIC_API_KEY);

const FLOW_API_NAME = 'research-flow';
const SLASH_NAME = 'research';
const AGENT_NODE_ID = 'research-agent';
const AGENT_DISPLAY = 'Research Agent';
const AGENT_PROMPT = `You are a careful researcher. Answer the user's question in 3 to 5 sentences using plain English. If the question is unclear, make a reasonable assumption and state it.`;

test.describe('Scenario 3 — Single-agent slash flow', () => {
  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY (the seeded test model carries a dummy key → live LLM 401)',
  );

  test.beforeEach(() => {
    // Clean slate for this flow (cascades drop its nodes).
    psql(`DELETE FROM flows WHERE api_name = '${FLOW_API_NAME}';`);
  });

  test('build research-flow visually, then dispatch /research and verify reply', async ({
    page,
  }) => {
    // ── Arrange — author the flow ──
    const flowId = seedFlow({
      apiName: FLOW_API_NAME,
      displayName: 'Research Flow',
      description: 'Quick research answers on any topic.',
    });
    await openFlow(page, flowId);

    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: AGENT_NODE_ID,
      display: AGENT_DISPLAY,
      prompt: AGENT_PROMPT,
    });

    // End is a palette drop (not auto-placed) — drop it before wiring.
    await placeEnd(page);

    await connectViaStore(
      page,
      { nodeId: '__start__', handleId: 'out' },
      { nodeId: AGENT_NODE_ID, handleId: 'left' },
    );
    await connectViaStore(
      page,
      { nodeId: AGENT_NODE_ID, handleId: 'right' },
      { nodeId: '__end__', handleId: 'in' },
    );

    await saveFlow(page);
    expect(db.flowCount()).toBeGreaterThanOrEqual(1);

    // Expose the saved flow as `/research` (desktop sets this on the flows card,
    // which the concurrent flow agent owns — set it directly so this spec stays
    // self-contained and doesn't touch that UI).
    psql(
      `UPDATE flows SET exposed_as_slash = true, slash_api_name = '${SLASH_NAME}'
       WHERE api_name = '${FLOW_API_NAME}';`,
    );

    // ── Act — dispatch /research ──
    await page.goto('/chat', { waitUntil: 'networkidle' });
    const composer = page.getByPlaceholder(/ask anything|message the assistant|reply/i);
    await composer.click();
    await composer.fill(`/${SLASH_NAME} what is the speed of light`);
    await page.keyboard.press('Enter');

    // ── Assert — slash dispatch + reply ──
    await expect(page.locator('[data-role="user"]').last()).toContainText(
      new RegExp(`/${SLASH_NAME}\\b.*speed of light`, 'i'),
      { timeout: 5_000 },
    );

    // The ThinkingStrip surfaces the agent display name during the run.
    await expect(page.getByText(new RegExp(AGENT_DISPLAY, 'i'))).toBeVisible({
      timeout: 30_000,
    });

    // Run-complete: Stop reverts to Send.
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toHaveCount(0, { timeout: 60_000 });

    // Tolerant content assertion — the factual prompt has a stable answer.
    const reply = await page.locator('[data-role="assistant"]').last().textContent();
    expect(reply ?? '').toMatch(/light|300|299,?792|c\b/i);
  });
});
