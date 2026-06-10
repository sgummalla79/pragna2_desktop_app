/**
 * Scenario 16 — Dynamic fan-out: author + visualize a dispatching edge.
 *
 * Desktop port of the web app's scenario-16. BE-only (no LLM key): it asserts
 * the EdgePanel dispatch editor + the on-edge "per-item" badge + a YAML
 * round-trip of the three dispatch fields (dispatch_mode / items_slot /
 * item_slot) through Save and reload.
 *
 * Desktop adaptations (reconciled against EdgePanel.tsx / ConditionEdge.tsx):
 *  - Flow seeded as a row + opened at /settings/flows/:id (no /flows/new).
 *  - data-testids added to the desktop source for this suite: `edge-panel`,
 *    `dispatch-toggle`, `dispatch-fields`, `items-slot-select`,
 *    `item-slot-select`, `dispatch-badge` (see EdgePanel.tsx / ConditionEdge.tsx).
 *  - The desktop badge text is `per-item` (not the web's `↴ per-item`) and the
 *    badge `title` reads `... per item in "raw_items".` — assertions match the
 *    desktop strings.
 *  - The desktop edge dispatch toggle is a native checkbox (`.check()` works).
 *  - Re-open path uses the "Back to Flows" link + the flow card "Open" button.
 */
import { test, expect } from '../fixtures';
import { psql } from '../helpers/db';
import {
  configureChatAgent,
  connectViaStore,
  dropFromPalette,
  openFlow,
  seedFlow,
} from '../helpers/flow-author';

test.describe.configure({ mode: 'serial' });

const FLOW_API_NAME = 'e2e-flow-dispatch-sketch';
const FLOW_DISPLAY = 'E2E Dispatch Sketch';

/** Read the producer→verifier edge id (+ its dispatch data) from the store. */
async function readDispatchEdge(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const store = (window as unknown as {
      __flowEditorStore?: {
        getState: () => {
          edges: Array<{
            id: string;
            source: string;
            target: string;
            data?: { dispatchMode?: string; itemsSlot?: string; itemSlot?: string };
          }>;
        };
      };
    }).__flowEditorStore;
    if (!store) throw new Error('window.__flowEditorStore not exposed');
    const e = store.getState().edges.find((x) => x.source === 'producer' && x.target === 'verifier');
    if (!e) return null;
    return { id: e.id, dispatchMode: e.data?.dispatchMode, itemsSlot: e.data?.itemsSlot, itemSlot: e.data?.itemSlot };
  });
}

test.describe('Scenario 16 — Dynamic fan-out: author + visualize', () => {
  let flowId: string;

  test.beforeEach(async ({ page }) => {
    psql(`DELETE FROM flows WHERE api_name = '${FLOW_API_NAME}';`);
    flowId = seedFlow({
      apiName: FLOW_API_NAME,
      displayName: FLOW_DISPLAY,
      description: 'Minimal flow to author a per-item dispatch edge.',
    });
    await openFlow(page, flowId);
  });

  test('build flow, declare per-item dispatch on edge, see badge + round-trip', async ({ page }) => {
    // ── Arrange — build producer → verifier → end ──
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: 'producer',
      display: 'Producer',
      prompt: 'Produce raw items.',
      outputs: ['raw_items'],
    });

    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: 'verifier',
      display: 'Verifier',
      prompt: 'Verify one item.',
      inputs: ['one_item'],
    });

    await connectViaStore(page, { nodeId: '__start__', handleId: 'out' }, { nodeId: 'producer', handleId: 'left' });
    await connectViaStore(page, { nodeId: 'producer', handleId: 'right' }, { nodeId: 'verifier', handleId: 'left' });
    await connectViaStore(page, { nodeId: 'verifier', handleId: 'right' }, { nodeId: '__end__', handleId: 'in' });

    // ── Act — click the producer→verifier edge, declare dispatch ──
    const before = await readDispatchEdge(page);
    expect(before).not.toBeNull();
    await page.locator(`[data-testid="rf__edge-${before!.id}"]`).dispatchEvent('click');
    await expect(page.getByTestId('edge-panel')).toBeVisible();
    await expect(page.getByTestId('edge-panel')).toContainText('producer → verifier');

    await page.getByTestId('dispatch-toggle').check();
    await expect(page.getByTestId('dispatch-fields')).toBeVisible();

    await page.getByTestId('items-slot-select').click();
    await page.getByRole('option', { name: 'raw_items' }).click();
    await page.getByTestId('item-slot-select').click();
    await page.getByRole('option', { name: 'one_item' }).click();

    await page.getByRole('button', { name: /close edge inspector/i }).click();
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('status')).toContainText(/Created|Saved/);

    // ── Assert — badge + dashed stroke ──
    const badge = page.getByTestId('dispatch-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('per-item');
    await expect(badge).toHaveAttribute('title', /raw_items/);

    const postSave = await readDispatchEdge(page);
    const path = page.locator(
      `[data-testid="rf__edge-${postSave!.id}"] .react-flow__edge-path`,
    );
    await expect(path).toHaveCSS('stroke-dasharray', /6.*3/);

    // ── Round-trip — back to list, then reopen the editor by id ──
    // First prove the back-link returns to the Flows list (the seeded flow's
    // card is present), then re-open the editor — re-navigating by id forces
    // a fresh BE refetch + re-hydrate, which is exactly the persistence path
    // we're verifying (the list-card "Open" button leads to the same URL).
    await page.getByRole('link', { name: /back to flows/i }).click();
    await page.waitForURL('**/settings/flows');
    // Wait for the editor to fully unmount (its dispatch badge is gone) so the
    // assertion below matches only the Flows-list card — not the editor's
    // lingering <h1> or the persistent "Saved …" toast (both contain the name).
    await expect(page.getByTestId('dispatch-badge')).toHaveCount(0);
    await expect(page.getByText(FLOW_DISPLAY, { exact: true })).toBeVisible();
    await openFlow(page, flowId);

    const reloaded = await readDispatchEdge(page);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.dispatchMode).toBe('per_item');
    expect(reloaded!.itemsSlot).toBe('raw_items');
    expect(reloaded!.itemSlot).toBe('one_item');

    await expect(page.getByTestId('dispatch-badge')).toBeVisible();

    // Re-click the edge — panel re-opens with the same picks.
    await page.locator(`[data-testid="rf__edge-${reloaded!.id}"]`).dispatchEvent('click');
    await expect(page.getByTestId('edge-panel')).toBeVisible();
    await expect(page.getByTestId('dispatch-toggle')).toBeChecked();
    await expect(page.getByTestId('dispatch-fields')).toContainText('raw_items');
    await expect(page.getByTestId('dispatch-fields')).toContainText('one_item');

    // BE persisted the three dispatch fields on the edge row.
    const row = psql(
      `SELECT dispatch_mode||'|'||items_slot||'|'||item_slot FROM flow_edges
       WHERE flow_id=(SELECT id FROM flows WHERE api_name='${FLOW_API_NAME}')
         AND from_node='producer' AND to_node='verifier';`,
    );
    expect(row).toBe('per_item|raw_items|one_item');
  });
});
