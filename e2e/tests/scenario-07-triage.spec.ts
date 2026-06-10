/**
 * Scenario 7 — In-flow routing (classifier → Decision → specialists):
 * AUTHORING + SAVE.
 *
 * Desktop port of the web app's scenario-07, narrowed to authoring + save. It
 * exercises the most intricate authoring surface: a classifier Agent with 3
 * custom emits feeding a Decision (router) node whose condition rows are
 * edited to [code, math, general], routing each port to a specialist Agent
 * (plus `port:else` → End). The three-branch chat dispatch (real-LLM-required,
 * chat surface owned elsewhere) is DEFERRED to the manual verification doc.
 *
 * Topology authored:
 *   Start → triage-router (emits=[code,math,general]) → decision_1
 *   decision_1 port:code    → triage-coder
 *   decision_1 port:math    → triage-mathematician
 *   decision_1 port:general → triage-generalist
 *   decision_1 port:else    → End
 *   each specialist         → End
 */
import { test, expect } from '../fixtures';
import { psql, psqlRows } from '../helpers/db';
import {
  configureChatAgent,
  connectViaStore,
  dropFromPalette,
  openFlow,
  placeEnd,
  seedFlow,
  setDecisionConditions,
} from '../helpers/flow-author';

test.describe.configure({ mode: 'serial' });

const FLOW_API_NAME = 'e2e-flow-triage';
const FLOW_DISPLAY = 'E2E Triage Router';

const ROUTER_ID = 'triage-router';
const DECISION_ID = 'decision_1';
const SPECIALISTS = [
  { nodeId: 'triage-coder', display: 'Coder Specialist' },
  { nodeId: 'triage-mathematician', display: 'Math Specialist' },
  { nodeId: 'triage-generalist', display: 'Generalist' },
] as const;

test.describe('Scenario 7 — Triage router (authoring)', () => {
  let flowId: string;

  test.beforeEach(async ({ page }) => {
    psql(`DELETE FROM flows WHERE api_name = '${FLOW_API_NAME}';`);
    flowId = seedFlow({
      apiName: FLOW_API_NAME,
      displayName: FLOW_DISPLAY,
      description: 'Classifies a question into code/math/general and routes it.',
    });
    await openFlow(page, flowId);
  });

  test('build classifier + decision + 3 specialists, wire per-port branches, save', async ({ page }) => {
    // Classifier with 3-way emits, reads user_query.
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: ROUTER_ID,
      display: 'Triage Router',
      prompt: 'Classify the question as code, math, or general; call set_route.',
      emits: ['code', 'math', 'general'],
      inputs: ['user_query'],
    });

    // Decision node — set its rows to the classifier's emits.
    await dropFromPalette(page, 'Decision');
    await setDecisionConditions(page, DECISION_ID, ['code', 'math', 'general']);

    // Three specialists.
    for (const spec of SPECIALISTS) {
      await dropFromPalette(page, 'Agent');
      await configureChatAgent(page, {
        nodeId: spec.nodeId,
        display: spec.display,
        prompt: `You are the ${spec.display}. Answer the user's question.`,
        inputs: ['user_query'],
      });
    }

    await placeEnd(page);

    await connectViaStore(page, { nodeId: '__start__', handleId: 'out' }, { nodeId: ROUTER_ID, handleId: 'left' });
    await connectViaStore(page, { nodeId: ROUTER_ID, handleId: 'right' }, { nodeId: DECISION_ID, handleId: 'in' });
    await connectViaStore(page, { nodeId: DECISION_ID, handleId: 'port:code' }, { nodeId: 'triage-coder', handleId: 'left' });
    await connectViaStore(page, { nodeId: DECISION_ID, handleId: 'port:math' }, { nodeId: 'triage-mathematician', handleId: 'left' });
    await connectViaStore(page, { nodeId: DECISION_ID, handleId: 'port:general' }, { nodeId: 'triage-generalist', handleId: 'left' });
    await connectViaStore(page, { nodeId: DECISION_ID, handleId: 'port:else' }, { nodeId: '__end__', handleId: 'in' });
    for (const spec of SPECIALISTS) {
      await connectViaStore(page, { nodeId: spec.nodeId, handleId: 'right' }, { nodeId: '__end__', handleId: 'in' });
    }

    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('status')).toContainText(/Created|Saved/);

    // ── DB projection ──
    // 4 agent nodes (router + 3 specialists) + 1 decision node.
    const nodes = psqlRows(
      `SELECT api_name, COALESCE(node_kind,'agent') FROM flow_nodes
       WHERE flow_id=(SELECT id FROM flows WHERE api_name='${FLOW_API_NAME}')
       ORDER BY api_name;`,
    );
    const agentNames = nodes.filter((r) => r[1] === 'agent').map((r) => r[0]).sort();
    expect(agentNames).toEqual([
      'triage-coder',
      'triage-generalist',
      'triage-mathematician',
      ROUTER_ID,
    ]);
    const decisionNames = nodes.filter((r) => r[1] === 'decision').map((r) => r[0]);
    expect(decisionNames).toEqual([DECISION_ID]);

    // The Decision node's conditions are the authoritative persisted form on
    // its branch edges' `condition` column (there is no `conditions` column on
    // flow_nodes — the desktop FE rebuilds decision rows from the per-port edge
    // conditions on reload, see buildEditorGraph.ts). The per-port branch edges
    // carry their derived condition:
    const branchEdges = psqlRows(
      `SELECT to_node, condition FROM flow_edges
       WHERE flow_id=(SELECT id FROM flows WHERE api_name='${FLOW_API_NAME}')
         AND from_node='${DECISION_ID}'
       ORDER BY to_node;`,
    ).map((r) => `${r[0]}:${r[1]}`);
    expect(branchEdges).toContain('triage-coder:code');
    expect(branchEdges).toContain('triage-mathematician:math');
    expect(branchEdges).toContain('triage-generalist:general');
  });
});
