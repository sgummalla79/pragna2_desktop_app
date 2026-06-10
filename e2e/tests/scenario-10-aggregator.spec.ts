/**
 * Scenario 10 — Aggregator (parallel fan-out + synthesis): AUTHORING + SAVE.
 *
 * Desktop port of the web app's scenario-10, narrowed to authoring + save. It
 * exercises a fan-out / fan-in topology: Start fans out to three perspective
 * Agents (each publishing its own named slot), which fan in to a synthesizer
 * that reads all three. The parallel-run chat dispatch (real-LLM-required,
 * chat surface owned elsewhere) is DEFERRED to the manual verification doc.
 *
 * Topology authored:
 *   Start ─┬→ agg-technical  ─┐
 *          ├→ agg-practical  ─┼→ agg-synthesizer → End
 *          └→ agg-historical ─┘
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

const FLOW_API_NAME = 'e2e-flow-aggregate';
const FLOW_DISPLAY = 'E2E Aggregator';

const PERSPECTIVES = [
  { nodeId: 'agg-technical', display: 'Technical Perspective', slot: 'perspective_tech' },
  { nodeId: 'agg-practical', display: 'Practical Perspective', slot: 'perspective_prac' },
  { nodeId: 'agg-historical', display: 'Historical Perspective', slot: 'perspective_hist' },
] as const;
const SYNTH_ID = 'agg-synthesizer';

test.describe('Scenario 10 — Aggregator fan-out/fan-in (authoring)', () => {
  let flowId: string;

  test.beforeEach(async ({ page }) => {
    psql(`DELETE FROM flows WHERE api_name = '${FLOW_API_NAME}';`);
    flowId = seedFlow({
      apiName: FLOW_API_NAME,
      displayName: FLOW_DISPLAY,
      description: 'Gets three perspectives in parallel, then synthesises them.',
    });
    await openFlow(page, flowId);
  });

  test('build fan-out to 3 perspectives + fan-in to synthesizer + save', async ({ page }) => {
    for (const p of PERSPECTIVES) {
      await dropFromPalette(page, 'Agent');
      await configureChatAgent(page, {
        nodeId: p.nodeId,
        display: p.display,
        prompt: `Give the ${p.display} on the question.`,
        inputs: ['user_query'],
        outputs: [p.slot],
      });
    }

    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: SYNTH_ID,
      display: 'Synthesizer',
      prompt: 'Weave the three perspectives into one synthesis.',
      inputs: ['perspective_tech', 'perspective_prac', 'perspective_hist'],
    });

    await placeEnd(page);

    for (const p of PERSPECTIVES) {
      await connectViaStore(page, { nodeId: '__start__', handleId: 'out' }, { nodeId: p.nodeId, handleId: 'left' });
      await connectViaStore(page, { nodeId: p.nodeId, handleId: 'right' }, { nodeId: SYNTH_ID, handleId: 'left' });
    }
    await connectViaStore(page, { nodeId: SYNTH_ID, handleId: 'right' }, { nodeId: '__end__', handleId: 'in' });

    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('status')).toContainText(/Created|Saved/);

    // 4 agent nodes (3 perspectives + synthesizer).
    const nodes = db.flowNodes(FLOW_API_NAME).map((r) => r[0]).sort();
    expect(nodes).toEqual(['agg-historical', 'agg-practical', SYNTH_ID, 'agg-technical']);
    expect(db.agentNodeCount()).toBeGreaterThanOrEqual(4);

    // Fan-in: all three perspectives edge into the synthesizer.
    const intoSynth = psqlRows(
      `SELECT from_node FROM flow_edges
       WHERE flow_id=(SELECT id FROM flows WHERE api_name='${FLOW_API_NAME}')
         AND to_node='${SYNTH_ID}'
       ORDER BY from_node;`,
    ).map((r) => r[0]);
    expect(intoSynth).toEqual(['agg-historical', 'agg-practical', 'agg-technical']);

    // Fan-out: Start edges into all three perspectives.
    const fromStart = psqlRows(
      `SELECT to_node FROM flow_edges
       WHERE flow_id=(SELECT id FROM flows WHERE api_name='${FLOW_API_NAME}')
         AND from_node='__start__'
       ORDER BY to_node;`,
    ).map((r) => r[0]);
    expect(fromStart).toEqual(['agg-historical', 'agg-practical', 'agg-technical']);
  });
});
