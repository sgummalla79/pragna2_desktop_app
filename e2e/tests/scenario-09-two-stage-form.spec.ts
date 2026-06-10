/**
 * Scenario 9 — Multi-pause HITL (two ask_user collectors): AUTHORING + SAVE.
 *
 * Desktop port of the web app's scenario-09, narrowed to authoring + save. It
 * exercises tool-chip authoring (`ask_user` on two nodes via the Tools
 * ChipInput) plus #26 slot wiring (stage-1 outputs `stage1_summary`; stage-2
 * reads `user_query` + `stage1_summary`). The runtime HITL leg — dispatching
 * the flow in chat, filling two forms in sequence, asserting the summary — is
 * real-LLM-required and drives the chat surface (owned by another agent), so
 * it is DEFERRED to the manual verification doc.
 *
 * Topology authored: Start → stage-1-collector → stage-2-collector → End.
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

const FLOW_API_NAME = 'e2e-flow-two-stage-form';
const FLOW_DISPLAY = 'E2E Two-Stage Form';

const STAGE1_ID = 'stage-1-collector';
const STAGE2_ID = 'stage-2-collector';

/** Add a tool chip to the currently-open NodePanel via the Tools ChipInput. */
async function addToolChip(page: import('@playwright/test').Page, nodeId: string, tool: string) {
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).dispatchEvent('click');
  await page.locator('#np-agent-tools').fill(tool);
  await page.locator('#np-agent-tools').press('Enter');
  await page.getByRole('button', { name: /close panel/i }).click();
}

test.describe('Scenario 9 — Two-stage HITL form (authoring)', () => {
  let flowId: string;

  test.beforeEach(async ({ page }) => {
    psql(`DELETE FROM flows WHERE api_name = '${FLOW_API_NAME}';`);
    flowId = seedFlow({
      apiName: FLOW_API_NAME,
      displayName: FLOW_DISPLAY,
      description: 'Collect identity, then preferences, then summarise.',
    });
    await openFlow(page, flowId);
  });

  test('build two ask_user collectors with slot wiring + save', async ({ page }) => {
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: STAGE1_ID,
      display: 'Stage 1 Collector',
      prompt: 'Call ask_user once to collect name + city, then confirm.',
      inputs: ['user_query'],
      outputs: ['stage1_summary'],
    });
    await addToolChip(page, STAGE1_ID, 'ask_user');

    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: STAGE2_ID,
      display: 'Stage 2 Collector',
      prompt: 'Call ask_user once to collect an activity, then summarise.',
      inputs: ['user_query', 'stage1_summary'],
    });
    await addToolChip(page, STAGE2_ID, 'ask_user');

    await placeEnd(page);

    await connectViaStore(page, { nodeId: '__start__', handleId: 'out' }, { nodeId: STAGE1_ID, handleId: 'left' });
    await connectViaStore(page, { nodeId: STAGE1_ID, handleId: 'right' }, { nodeId: STAGE2_ID, handleId: 'left' });
    await connectViaStore(page, { nodeId: STAGE2_ID, handleId: 'right' }, { nodeId: '__end__', handleId: 'in' });

    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('status')).toContainText(/Created|Saved/);

    const nodes = db.flowNodes(FLOW_API_NAME).map((r) => r[0]).sort();
    expect(nodes).toEqual([STAGE1_ID, STAGE2_ID]);

    // Both collectors persisted the ask_user tool (tools jsonb column).
    const toolRows = psqlRows(
      `SELECT api_name, tools::text FROM flow_nodes
       WHERE flow_id=(SELECT id FROM flows WHERE api_name='${FLOW_API_NAME}')
       ORDER BY api_name;`,
    );
    for (const [, tools] of toolRows) {
      expect(tools).toContain('ask_user');
    }
  });
});
