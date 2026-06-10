/**
 * Scenario 5 — Sequential pipeline (research → summarize): AUTHORING + SAVE.
 *
 * Desktop port of the web app's scenario-05, narrowed to the authoring half
 * (build the 2-node pipeline in the visual editor + Save + assert the DB
 * projection). The web app's second half — dispatching `/research-pipeline`
 * in chat and asserting two streamed assistant bubbles — is DEFERRED: it is
 * real-LLM-required (no E2E_ANTHROPIC_API_KEY here) AND drives the chat
 * surface, which is owned by another agent in this project. See the manual
 * verification doc for the chat-dispatch leg.
 *
 * Topology authored: Start → pipeline-researcher → pipeline-summarizer → End,
 * with #26 slot wiring (researcher outputs `research_notes`; summarizer reads
 * it). Flow seeded + opened at /settings/flows/:id (no /flows/new route).
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

const FLOW_API_NAME = 'e2e-flow-research-pipeline';
const FLOW_DISPLAY = 'E2E Research Pipeline';

const RESEARCHER_ID = 'pipeline-researcher';
const SUMMARIZER_ID = 'pipeline-summarizer';

test.describe('Scenario 5 — Sequential pipeline (authoring)', () => {
  let flowId: string;

  test.beforeEach(async ({ page }) => {
    psql(`DELETE FROM flows WHERE api_name = '${FLOW_API_NAME}';`);
    flowId = seedFlow({
      apiName: FLOW_API_NAME,
      displayName: FLOW_DISPLAY,
      description: 'Researches a topic, then condenses to one sentence.',
    });
    await openFlow(page, flowId);
  });

  test('build 2-node pipeline with slot wiring + save', async ({ page }) => {
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: RESEARCHER_ID,
      display: 'Pipeline Researcher',
      prompt: 'You are a researcher. Explain the topic in 3-5 sentences.',
      outputs: ['research_notes'],
    });

    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: SUMMARIZER_ID,
      display: 'Pipeline Summarizer',
      prompt: 'Condense the research passage into one sentence.',
      inputs: ['research_notes'],
    });

    await placeEnd(page);

    await connectViaStore(page, { nodeId: '__start__', handleId: 'out' }, { nodeId: RESEARCHER_ID, handleId: 'left' });
    await connectViaStore(page, { nodeId: RESEARCHER_ID, handleId: 'right' }, { nodeId: SUMMARIZER_ID, handleId: 'left' });
    await connectViaStore(page, { nodeId: SUMMARIZER_ID, handleId: 'right' }, { nodeId: '__end__', handleId: 'in' });

    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('status')).toContainText(/Created|Saved/);

    // ── DB projection: two agent nodes under this flow ──
    expect(db.flowCount()).toBeGreaterThanOrEqual(1);
    const nodes = db.flowNodes(FLOW_API_NAME).map((r) => r[0]).sort();
    expect(nodes).toEqual([RESEARCHER_ID, SUMMARIZER_ID]);
    expect(db.agentNodeCount()).toBeGreaterThanOrEqual(2);

    // The sequential topology persisted (start → researcher → summarizer → end).
    const edges = psqlRows(
      `SELECT from_node, to_node FROM flow_edges
       WHERE flow_id=(SELECT id FROM flows WHERE api_name='${FLOW_API_NAME}')
       ORDER BY from_node, to_node;`,
    ).map((r) => `${r[0]}->${r[1]}`);
    expect(edges).toEqual([
      `${RESEARCHER_ID}->${SUMMARIZER_ID}`,
      `${SUMMARIZER_ID}->__end__`,
      `__start__->${RESEARCHER_ID}`,
    ]);
  });
});
