/**
 * Scenario 6 — Reflection / revision loop (drafter ↔ reviewer).
 *
 * The canonical decision-router loop:
 *   Start → haiku-drafter → haiku-reviewer → decision_1
 *   decision_1 (port:passed) → End
 *   decision_1 (port:failed) → haiku-drafter (loop back)
 *
 * The reviewer is a plain Agent that declares emits=[passed, failed], states its
 * judgement AND calls `set_route`, then feeds a deterministic Decision (router)
 * node whose default condition rows [passed, failed] route the emitted label.
 *
 * Slot wiring: drafter inputs [user_query, critique] / outputs [draft];
 * reviewer inputs [draft] / outputs [critique].
 *
 * Real-LLM-required: the seeded test model carries a dummy key, so without
 * `E2E_ANTHROPIC_API_KEY` the spec self-skips.
 *
 * Desktop adaptations vs the web app: auth via the seed-token `page` fixture (no
 * login); flows authored via `seedFlow` + `openFlow` (no `/flows/new` route);
 * slash exposure set via psql (owned by the flows card UI, not touched here);
 * composer matched by placeholder; turns carry `data-role`; DB topology asserted
 * via `db.flowNodes` (the desktop db helper has no `agentsForFlow`); and
 * run-complete is the Stop button reverting to Send (the desktop ThinkingStrip
 * is hidden when idle, with no "Ready" aria-label).
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

const HAS_REAL_KEY = Boolean(process.env.E2E_LLM_API_KEY ?? process.env.E2E_ANTHROPIC_API_KEY ?? process.env.E2E_OPENAI_API_KEY ?? process.env.E2E_GOOGLE_API_KEY);

const FLOW_API_NAME = 'revise-loop';
const SLASH_NAME = 'revise';

const DRAFTER_ID = 'haiku-drafter';
const DRAFTER_PROMPT = `The user's topic appears below. Write a haiku (3 lines, roughly 5/7/5 syllables) on that topic. If a critique block is also below, address every concern in your revision. Output ONLY the haiku — no preface, no commentary.`;

const REVIEWER_ID = 'haiku-reviewer';
// First Decision node dropped on the canvas auto-ids `decision_1`.
const DECISION_ID = 'decision_1';
const REVIEWER_PROMPT = `A haiku draft appears below. Verify (a) exactly 3 lines, (b) roughly 5/7/5 syllables. Reply with one short sentence stating your judgement, then call set_route: target="passed" if BOTH checks succeed; target="failed" if either fails. Be slightly lenient on syllable counts — a 4/7/5 or 5/8/5 passes if the spirit is right.`;

test.describe('Scenario 6 — Revise loop (agent → decision router)', () => {
  // Up to 3 sequential LLM calls plus authoring.
  test.describe.configure({ timeout: 240_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires a real LLM key (E2E_LLM_API_KEY or E2E_<PROVIDER>_API_KEY) (the seeded test model carries a dummy key → live LLM 401)',
  );

  test.beforeEach(() => {
    // Clear episodes that RESTRICT-reference the flow (a prior /revise dispatch
    // creates a conversation_episodes row pinned to flow_id) BEFORE deleting the
    // flow — otherwise the flow DELETE fails the FK and the next seedFlow hits
    // uq_flows_user_name. Makes the spec re-runnable against a persistent DB.
    psql(
      `DELETE FROM conversation_episodes
       WHERE flow_id IN (SELECT id FROM flows WHERE api_name = '${FLOW_API_NAME}');`,
    );
    psql(`DELETE FROM flows WHERE api_name = '${FLOW_API_NAME}';`);
  });

  test('build revise-loop, dispatch /revise, see drafter + reviewer bubbles', async ({
    page,
  }) => {
    // ── Arrange ──
    const flowId = seedFlow({
      apiName: FLOW_API_NAME,
      displayName: 'Revise Loop',
      description: 'Drafts a haiku and revises until a reviewer approves.',
    });
    await openFlow(page, flowId);

    // Drafter (chat Agent — reads user_query + critique slots, publishes draft).
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: DRAFTER_ID,
      display: 'Haiku Drafter',
      prompt: DRAFTER_PROMPT,
      inputs: ['user_query', 'critique'],
      outputs: ['draft'],
    });

    // Reviewer (plain Agent — declares emits=[passed, failed], reads draft,
    // publishes critique).
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: REVIEWER_ID,
      display: 'Haiku Reviewer',
      prompt: REVIEWER_PROMPT,
      inputs: ['draft'],
      outputs: ['critique'],
      emits: ['passed', 'failed'],
    });

    // Decision (router) node downstream of the reviewer — drops seeded with the
    // default conditions [passed, failed], which match the reviewer's emits.
    await dropFromPalette(page, 'Decision');

    // End is a palette drop — place it before wiring the terminator.
    await placeEnd(page);

    await connectViaStore(
      page,
      { nodeId: '__start__', handleId: 'out' },
      { nodeId: DRAFTER_ID, handleId: 'left' },
    );
    await connectViaStore(
      page,
      { nodeId: DRAFTER_ID, handleId: 'right' },
      { nodeId: REVIEWER_ID, handleId: 'left' },
    );
    await connectViaStore(
      page,
      { nodeId: REVIEWER_ID, handleId: 'right' },
      { nodeId: DECISION_ID, handleId: 'in' },
    );
    await connectViaStore(
      page,
      { nodeId: DECISION_ID, handleId: 'port:passed' },
      { nodeId: '__end__', handleId: 'in' },
    );
    await connectViaStore(
      page,
      { nodeId: DECISION_ID, handleId: 'port:failed' },
      { nodeId: DRAFTER_ID, handleId: 'top' },
    );

    await saveFlow(page);

    // DB invariants — confirm the topology persisted (both agents + the
    // deterministic decision node appear as flow_nodes).
    const nodeIds = db.flowNodes(FLOW_API_NAME).map((r) => r[0]).sort();
    expect(nodeIds).toEqual(expect.arrayContaining([DRAFTER_ID, REVIEWER_ID]));

    // Expose as `/revise` (set directly — the flows card UI is owned elsewhere).
    psql(
      `UPDATE flows SET exposed_as_slash = true, slash_api_name = '${SLASH_NAME}'
       WHERE api_name = '${FLOW_API_NAME}';`,
    );

    // ── Act ──
    await page.goto('/chat', { waitUntil: 'networkidle' });
    const composer = page.getByPlaceholder(/ask .*anything|message the assistant|reply/i);
    await composer.click();
    await composer.fill(`/${SLASH_NAME} cherry blossoms`);
    await page.keyboard.press('Enter');

    // ── Assert ──
    await expect(page.locator('[data-role="user"]').last()).toContainText(
      /cherry blossoms/i,
      { timeout: 5_000 },
    );

    // Run-complete: the Stop button reverts to Send once the loop settles. A
    // revise-and-pass run produces >= 2 assistant bubbles (drafter + reviewer).
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toHaveCount(0, { timeout: 180_000 });

    // Poll the final transcript shape.
    await expect(async () => {
      const bubbles = await page.locator('[data-role="assistant"]').allTextContents();
      expect(bubbles.length).toBeGreaterThanOrEqual(2);
      // At least one bubble looks haiku-like (>= 3 non-empty lines).
      const haikuLike = bubbles.some(
        (b) => b.split('\n').filter((l) => l.trim()).length >= 3,
      );
      expect(haikuLike).toBeTruthy();
      // The final reviewer judgement is bounded (not the much longer haiku).
      expect(bubbles[bubbles.length - 1].length).toBeLessThan(800);
    }).toPass({ timeout: 30_000, intervals: [500, 1000, 2000] });
  });
});
