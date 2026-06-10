/**
 * Scenario 8 — Plan & Execute (planner → executor): AUTHORING + SAVE.
 *
 * Desktop port of the web app's scenario-08, narrowed to authoring + save (same
 * shape as scenario 5). The chat-dispatch leg (`/plan-and-do` → planner +
 * executor bubbles) is real-LLM-required and drives the chat surface (owned by
 * another agent), so it is DEFERRED to the manual verification doc.
 *
 * Topology authored: Start → plan-planner → plan-executor → End, with #26 slot
 * wiring (planner outputs `plan`; executor reads it).
 */
import { test, expect } from '../fixtures';
import { db, psql, psqlRows } from '../helpers/db';
import {
  configureChatAgent,
  connectViaStore,
  dropFromPalette,
  openFlow,
  placeEnd,
  seedFlow,
} from '../helpers/flow-author';

test.describe.configure({ mode: 'serial' });

const FLOW_API_NAME = 'e2e-flow-plan-and-do';
const FLOW_DISPLAY = 'E2E Plan & Do';

const PLANNER_ID = 'plan-planner';
const EXECUTOR_ID = 'plan-executor';

test.describe('Scenario 8 — Plan & Execute (authoring)', () => {
  let flowId: string;

  test.beforeEach(async ({ page }) => {
    psql(`DELETE FROM flows WHERE api_name = '${FLOW_API_NAME}';`);
    flowId = seedFlow({
      apiName: FLOW_API_NAME,
      displayName: FLOW_DISPLAY,
      description: 'A planner outlines steps, then an executor performs them.',
    });
    await openFlow(page, flowId);
  });

  test('build planner → executor pipeline with slot wiring + save', async ({ page }) => {
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: PLANNER_ID,
      display: 'Planner',
      prompt: 'Output a numbered plan of 3-5 steps. Begin with "Plan:".',
      outputs: ['plan'],
    });

    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: EXECUTOR_ID,
      display: 'Executor',
      prompt: 'Execute each plan step, one line per step. End with "Done.".',
      inputs: ['plan'],
    });

    await placeEnd(page);

    await connectViaStore(page, { nodeId: '__start__', handleId: 'out' }, { nodeId: PLANNER_ID, handleId: 'left' });
    await connectViaStore(page, { nodeId: PLANNER_ID, handleId: 'right' }, { nodeId: EXECUTOR_ID, handleId: 'left' });
    await connectViaStore(page, { nodeId: EXECUTOR_ID, handleId: 'right' }, { nodeId: '__end__', handleId: 'in' });

    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('status')).toContainText(/Created|Saved/);

    expect(db.flowCount()).toBeGreaterThanOrEqual(1);
    const nodes = db.flowNodes(FLOW_API_NAME).map((r) => r[0]).sort();
    expect(nodes).toEqual([EXECUTOR_ID, PLANNER_ID]);
    expect(db.agentNodeCount()).toBeGreaterThanOrEqual(2);

    const edges = psqlRows(
      `SELECT from_node, to_node FROM flow_edges
       WHERE flow_id=(SELECT id FROM flows WHERE api_name='${FLOW_API_NAME}')
       ORDER BY from_node, to_node;`,
    ).map((r) => `${r[0]}->${r[1]}`);
    expect(edges).toEqual([
      `${EXECUTOR_ID}->__end__`,
      `${PLANNER_ID}->${EXECUTOR_ID}`,
      `__start__->${PLANNER_ID}`,
    ]);
  });
});
