/**
 * Scenario 17 — Dynamic fan-out: mutual-exclusion gate (agent with emits).
 *
 * Desktop port of the web app's scenario-17. BE-only (no LLM). A source agent
 * that declares `emits` already branches, so the EdgePanel must DISABLE the
 * dispatch toggle and surface an amber callout naming the emits + the v1 rule
 * (EdgePanel.tsx `dispatchBlockedReason`). This pre-empts the BE validator's
 * mutual-exclusion 422 in the visual editor.
 *
 * Desktop adaptations: flow seeded + opened at /settings/flows/:id; the gate
 * callout carries `data-testid="dispatch-blocked-reason"` and the toggle
 * `data-testid="dispatch-toggle"` (added to EdgePanel.tsx for this suite). The
 * desktop wording: `... already branches via emits ["passed","failed"]. A node
 * either branches or fans out — not both (v1).`
 */
import { test, expect } from '../fixtures';
import { psql } from '../helpers/db';
import {
  configureChatAgent,
  connectViaStore,
  dropFromPalette,
  openFlow,
  placeEnd,
  seedFlow,
} from '../helpers/flow-author';

test.describe.configure({ mode: 'serial' });

const FLOW_API_NAME = 'e2e-flow-gate-sketch';
const FLOW_DISPLAY = 'E2E Gate Sketch';

test.describe('Scenario 17 — Dynamic fan-out: mutual-exclusion gate', () => {
  let flowId: string;

  test.beforeEach(async ({ page }) => {
    psql(`DELETE FROM flows WHERE api_name = '${FLOW_API_NAME}';`);
    flowId = seedFlow({
      apiName: FLOW_API_NAME,
      displayName: FLOW_DISPLAY,
      description: 'Minimal flow to test the dispatch mutual-exclusion gate.',
    });
    await openFlow(page, flowId);
  });

  test('agent-with-emits source disables dispatch toggle, shows amber callout naming emits', async ({
    page,
  }) => {
    // A plain Agent that declares emits=[passed, failed] — the gate trigger.
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: 'node_1',
      display: 'Classifier',
      prompt: 'Classify the input and call set_route.',
      emits: ['passed', 'failed'],
      inputs: ['user_query'],
    });

    // Worker is the dispatch-target stand-in (no declared inputs — the gate
    // test is about the SOURCE's emits, not the target).
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: 'worker',
      display: 'Worker',
      prompt: 'Process the payload.',
    });

    await placeEnd(page);
    await connectViaStore(page, { nodeId: '__start__', handleId: 'out' }, { nodeId: 'node_1', handleId: 'left' });
    await connectViaStore(page, { nodeId: 'node_1', handleId: 'right' }, { nodeId: 'worker', handleId: 'left' });
    await connectViaStore(page, { nodeId: 'worker', handleId: 'right' }, { nodeId: '__end__', handleId: 'in' });

    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('status')).toContainText(/Created|Saved/);

    // ── Click the node_1 → worker edge, open EdgePanel ──
    const gatedEdgeId = await page.evaluate(() => {
      const store = (window as unknown as {
        __flowEditorStore?: {
          getState: () => { edges: Array<{ id: string; source: string; target: string }> };
        };
      }).__flowEditorStore;
      if (!store) throw new Error('window.__flowEditorStore not exposed');
      const e = store.getState().edges.find((x) => x.source === 'node_1' && x.target === 'worker');
      if (!e) throw new Error('node_1→worker edge not found');
      return e.id;
    });

    await page.locator(`[data-testid="rf__edge-${gatedEdgeId}"]`).dispatchEvent('click');
    await expect(page.getByTestId('edge-panel')).toBeVisible();

    // ── Assert — toggle disabled + callout naming emits ──
    const toggle = page.getByTestId('dispatch-toggle');
    await expect(toggle).toBeDisabled();
    await expect(toggle).not.toBeChecked();

    const callout = page.getByTestId('dispatch-blocked-reason');
    await expect(callout).toBeVisible();
    await expect(callout).toContainText(/branches via emits/);
    await expect(callout).toContainText(/passed/);
    await expect(callout).toContainText(/failed/);
    await expect(callout).toContainText(/either branches or fans out/);
    await expect(callout).toContainText(/\(v1\)/);

    // Dropdowns not rendered (dispatch can't be turned on); no badge anywhere.
    await expect(page.getByTestId('dispatch-fields')).toHaveCount(0);
    await expect(page.getByTestId('dispatch-badge')).toHaveCount(0);
  });
});
