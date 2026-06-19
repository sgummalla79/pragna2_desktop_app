/**
 * Drag the Start node — confirms a node drag moves only that node, leaves the
 * stationary End put, flips the editor dirty (Save enables), and keeps Start's
 * `out` handle.
 *
 * Desktop port of the web app's flow-design-drag-start. Flow is seeded +
 * opened at /settings/flows/:id (no /flows/new route). The Save button enables
 * on drag-end via the store's position-change reducer (useFlowEditorStore.ts:
 * `isMutatingNodeChange` → position with dragging===false).
 */
import { test, expect } from '../fixtures';
import { psql } from '../helpers/db';
import { nodeFlowPosition } from '../helpers/canvas';
import { dropFromPalette, openFlow, seedFlow } from '../helpers/flow-author';

const FLOW_API_NAME = 'e2e-flow-drag-start';
const FLOW_DISPLAY = 'E2E Drag Start';

test('drag Start node downward', async ({ page }) => {
  test.setTimeout(60_000);

  psql(`DELETE FROM flows WHERE api_name = '${FLOW_API_NAME}';`);
  const flowId = seedFlow({ apiName: FLOW_API_NAME, displayName: FLOW_DISPLAY });
  await openFlow(page, flowId);

  // Drop an Agent (downstream node) + an End sink (stationary reference).
  await dropFromPalette(page, 'Agent');
  // Close the panel that opens on the freshly-dropped agent.
  await page.getByRole('button', { name: /close panel/i }).click();
  await dropFromPalette(page, 'End');
  await page.waitForTimeout(200);

  const startBefore = await page.locator('[data-id="__start__"]').boundingBox();
  expect(startBefore).toBeTruthy();
  // End's FLOW-space position (graph coords, pan-independent) — the invariant a
  // Start drag must leave unchanged. Screen pixels shift when React Flow
  // auto-pans during the drag, so measure graph coords (tracker #139).
  const endFlowBefore = await nodeFlowPosition(page, '__end__');

  // ── Drag Start down by ~300px ──
  const box = await page.locator('[data-id="__start__"]').boundingBox();
  if (!box) throw new Error('Start node has no bounding box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 150, { steps: 6 });
  await page.mouse.move(cx, cy + 300, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const startAfter = await page.locator('[data-id="__start__"]').boundingBox();
  const endFlowAfter = await nodeFlowPosition(page, '__end__');

  // 1. Start moved down ~300px (tolerance for grid snap + pixel precision).
  expect(startAfter!.y - startBefore!.y).toBeGreaterThan(250);
  expect(startAfter!.y - startBefore!.y).toBeLessThan(350);

  // 2. End did NOT move — asserted in FLOW space, so an auto-pan of the viewport
  //    during the drag (which shifts End's screen pixels) doesn't false-fail.
  //    A small epsilon covers sub-pixel transform rounding.
  expect(Math.abs(endFlowAfter.x - endFlowBefore.x)).toBeLessThan(1);
  expect(Math.abs(endFlowAfter.y - endFlowBefore.y)).toBeLessThan(1);

  // 3. Save now enabled (dirty fires on drag-end).
  await expect(page.getByRole('button', { name: /^save$/i })).toBeEnabled();

  // 4. Start handle id still 'out'.
  await expect(page.locator('[data-id="__start__"] [data-handleid="out"]')).toBeVisible();
});
