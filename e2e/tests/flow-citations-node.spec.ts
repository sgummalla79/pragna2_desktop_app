/**
 * Visual flow editor — Citations node (Tier 2 of pragna2_desktop_app#99).
 *
 * Drives the REAL FlowBuilder in browser-fallback against the Docker
 * nexus-kit-api: add a Citations node from the palette, edit a slot, wire
 * start → citations → end, Save, and assert the BE persisted a
 * `node_kind: citations` flow_node (deterministic — user_model_id NULL) with the
 * slot in its context_config; then reload and confirm the slot survives.
 *
 * Also covers the decided headline rule — a citations node accepts exactly ONE
 * inbound edge — via a real draw-time drag (the store-bypassing connectViaStore
 * can't exercise isValidConnection, so this uses the mouse like the self-loop
 * test in flow-editor.spec).
 *
 * Auth: seed-token `page` fixture (no login form). Each test seeds its own flow
 * row with a unique api_name so specs never collide on the shared DB.
 */
import { test, expect } from '../fixtures';
import { revealAndGetHandle } from '../helpers/canvas';
import { psql } from '../helpers/db';
import {
  configureChatAgent,
  connectViaStore,
  dropFromPalette,
  openFlow,
  placeEnd,
  saveFlow,
  seedFlow,
} from '../helpers/flow-author';

test.describe.configure({ mode: 'serial' }); // shared DB → run in order

const FLOW_API = 'e2e-fe-citations';
const FLOW_DISPLAY = 'E2E FE Citations';
const SOURCES_SLOT = 'e2e_sources';
const DRAFT_SLOT = 'e2e_draft';

test.describe('Visual flow editor — Citations node', () => {
  let flowId: string;

  test.beforeEach(async ({ page }) => {
    psql(`DELETE FROM flows WHERE api_name LIKE 'e2e-fe-citations%';`);
    flowId = seedFlow({ apiName: FLOW_API, displayName: FLOW_DISPLAY });
    await openFlow(page, flowId);
  });

  test('palette adds a Citations node and opens its panel with default placeholders', async ({
    page,
  }) => {
    await dropFromPalette(page, 'Citations');
    await expect(page.locator('.react-flow__node[data-id="citations_1"]')).toBeVisible();

    // Panel opens on the new node; slot inputs show the BE defaults as placeholders.
    await expect(page.getByRole('heading', { name: 'Citations', exact: true })).toBeVisible();
    await expect(page.getByLabel('Sources slot')).toHaveValue('');
    await expect(page.getByLabel('Sources slot')).toHaveAttribute('placeholder', 'sources');
    await expect(page.getByLabel('Draft slot')).toHaveAttribute('placeholder', 'draft');
    await expect(page.getByLabel('Output slot')).toHaveAttribute('placeholder', 'cited_report');
  });

  test('save persists a deterministic node_kind=citations with its slot, and it survives reload', async ({
    page,
  }) => {
    // A valid citations flow: the sources + draft slots must be PRODUCED
    // upstream (BE hard-validation), so wire two producer agents ahead of the
    // citations node and point its slots at their outputs.
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: 'searcher',
      display: 'Searcher',
      prompt: 'Find sources.',
      outputs: [SOURCES_SLOT],
    });
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: 'synth',
      display: 'Synthesize',
      prompt: 'Write a report citing each claim as [[<url>]].',
      outputs: [DRAFT_SLOT],
    });

    await dropFromPalette(page, 'Citations');
    await page.getByLabel('Sources slot').fill(SOURCES_SLOT);
    await page.getByLabel('Draft slot').fill(DRAFT_SLOT);
    await page.getByRole('button', { name: /close panel/i }).click();

    // __start__ → searcher → synth → citations_1 → __end__
    await placeEnd(page);
    await connectViaStore(page, { nodeId: '__start__', handleId: 'out' }, { nodeId: 'searcher', handleId: 'left' });
    await connectViaStore(page, { nodeId: 'searcher', handleId: 'right' }, { nodeId: 'synth', handleId: 'left' });
    await connectViaStore(page, { nodeId: 'synth', handleId: 'right' }, { nodeId: 'citations_1', handleId: 'in' });
    await connectViaStore(page, { nodeId: 'citations_1', handleId: 'out' }, { nodeId: '__end__', handleId: 'in' });

    await saveFlow(page);

    // BE persisted a deterministic citations node (user_model_id NULL) carrying
    // the slot names in context_config.
    const row = psql(
      `SELECT node_kind, (user_model_id IS NULL), context_config::text
         FROM flow_nodes
        WHERE api_name='citations_1'
          AND flow_id=(SELECT id FROM flows WHERE api_name='${FLOW_API}');`,
    );
    expect(row).toContain('citations'); // node_kind
    expect(row).toContain('t'); // user_model_id IS NULL → deterministic
    expect(row).toContain(SOURCES_SLOT); // slot mirrored into context_config

    // Reload the editor — the node + its slot value rehydrate from the saved YAML.
    await openFlow(page, flowId);
    await page.locator('.react-flow__node[data-id="citations_1"]').dispatchEvent('click');
    await expect(page.getByLabel('Sources slot')).toHaveValue(SOURCES_SLOT);
  });

  test('rejects a SECOND inbound edge into the citations node at draw time', async ({ page }) => {
    await dropFromPalette(page, 'Citations');
    await page.getByRole('button', { name: /close panel/i }).click();

    // First inbound edge (via the store) — citations_1 now has one in-edge.
    await connectViaStore(page, { nodeId: '__start__', handleId: 'out' }, { nodeId: 'citations_1', handleId: 'in' });
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // Add a second potential source and DRAW from it into citations_1.
    await dropFromPalette(page, 'Agent');
    await page.getByRole('button', { name: /close panel/i }).click();
    const from = await revealAndGetHandle(page, 'agent_1', 'right');
    const to = await revealAndGetHandle(page, 'citations_1', 'in');
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // The draw-time rule blocked it — still exactly one inbound edge.
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  });
});
