/**
 * Movable palette — drag the floating node tray by its header and confirm it
 * repositions, then confirm its buttons are still clickable post-move.
 *
 * Desktop port of the web app's flow-design-movable-palette. The palette nav
 * (aria-label "Add node") and the drag handle (title "Drag to move the
 * palette") match the desktop PalettePanel.tsx 1:1. Flow is seeded + opened at
 * /settings/flows/:id (no /flows/new route).
 */
import { test, expect } from '../fixtures';
import { psql } from '../helpers/db';
import { openFlow, seedFlow } from '../helpers/flow-author';

const FLOW_API_NAME = 'e2e-flow-movable-palette';
const FLOW_DISPLAY = 'E2E Movable Palette';

test('palette can be dragged to a new position via the header', async ({ page }) => {
  test.setTimeout(60_000);

  psql(`DELETE FROM flows WHERE api_name = '${FLOW_API_NAME}';`);
  const flowId = seedFlow({ apiName: FLOW_API_NAME, displayName: FLOW_DISPLAY });
  await openFlow(page, flowId);

  const palette = page.getByRole('navigation', { name: /add node/i });
  const before = await palette.boundingBox();
  expect(before).toBeTruthy();

  const handle = page.getByTitle('Drag to move the palette');
  const handleBox = await handle.boundingBox();
  expect(handleBox).toBeTruthy();
  const cx = handleBox!.x + handleBox!.width / 2;
  const cy = handleBox!.y + handleBox!.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy + 75, { steps: 6 });
  await page.mouse.move(cx + 200, cy + 150, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  const after = await palette.boundingBox();
  expect(after!.x - before!.x).toBeGreaterThan(150);
  expect(after!.x - before!.x).toBeLessThan(250);
  expect(after!.y - before!.y).toBeGreaterThan(100);
  expect(after!.y - before!.y).toBeLessThan(200);

  // Buttons still clickable after the move — drop an Agent.
  await palette.getByRole('button', { name: /^Agent$/ }).click();
  await page.waitForTimeout(200);
  await expect(page.locator('[data-id="agent_1"]')).toBeVisible();
});
