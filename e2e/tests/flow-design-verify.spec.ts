/**
 * Flow editor design verify — palette + per-node handle layout + N+1 ports.
 *
 * Desktop port of the web app's flow-design-verify. Drops one of each palette
 * kind (Agent / If-else / End ×2) and asserts the handle topology:
 *  - Start (singleton): 1 source handle id='out'.
 *  - End instances: each 1 target handle id='in' (ids `__end__`, `__end__::2`).
 *  - Agent: 4 omni handles top/right/bottom/left.
 *  - Decision (router): 1 left target `in` + N+1 right `port:*` (passed/
 *    failed/else) — defaults [passed, failed].
 *  - Card content: "If / else" + "Agent" + agent_1 label.
 *  - No legacy midpoint <select> on the canvas.
 *  - Default layout: End sits right of Start.
 *
 * Desktop adaptations vs the web app: the flow is seeded + opened at
 * /settings/flows/:id (no /flows/new route); the "Draft" chip and the legacy
 * `/settings/flows/:id/edit` redirect have NO desktop equivalent and are
 * dropped (the desktop detail view has a "Saved/Unsaved" toolbar pill instead,
 * and there is no legacy edit route to redirect).
 */
import { test, expect } from '../fixtures';
import { psql } from '../helpers/db';
import { dropFromPalette, openFlow, seedFlow } from '../helpers/flow-author';

const FLOW_API_NAME = 'e2e-flow-design-verify';
const FLOW_DISPLAY = 'E2E Design Verify';

test('flow editor — palette + N+1 ports + handle layout', async ({ page }) => {
  psql(`DELETE FROM flows WHERE api_name = '${FLOW_API_NAME}';`);
  const flowId = seedFlow({ apiName: FLOW_API_NAME, displayName: FLOW_DISPLAY });
  await openFlow(page, flowId);

  // Palette: the three entries we drop here.
  const palette = page.getByRole('navigation', { name: /add node/i });
  await expect(palette.getByRole('button', { name: /^Agent$/ })).toBeVisible();
  await expect(palette.getByRole('button', { name: /^If \/ else$/ })).toBeVisible();
  await expect(palette.getByRole('button', { name: /^End$/ })).toBeVisible();

  // Drop one of each kind; End TWICE to exercise the multi-End id scheme.
  await dropFromPalette(page, 'Agent');
  await dropFromPalette(page, 'Decision');
  await dropFromPalette(page, 'End');
  await dropFromPalette(page, 'End');
  await page.waitForTimeout(300);

  // ── Start: exactly one source handle id='out' ──
  expect(await page.locator('[data-id="__start__"] .react-flow__handle').count()).toBe(1);
  await expect(page.locator('[data-id="__start__"] [data-handleid="out"]')).toBeVisible();

  // ── End instances: each one target handle id='in' ──
  const endIds = await page
    .locator('.react-flow__node[data-id^="__end__"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
  expect(endIds.sort()).toEqual(['__end__', '__end__::2']);
  for (const eid of endIds) {
    expect(await page.locator(`[data-id="${eid}"] .react-flow__handle`).count()).toBe(1);
    await expect(page.locator(`[data-id="${eid}"] [data-handleid="in"]`)).toBeVisible();
  }

  // ── Agent: 4 omni handles ──
  expect(await page.locator('[data-id="agent_1"] .react-flow__handle').count()).toBe(4);
  for (const hid of ['top', 'right', 'bottom', 'left']) {
    await expect(page.locator(`[data-id="agent_1"] [data-handleid="${hid}"]`)).toBeAttached();
  }

  // ── Decision: 1 in + 3 out (port:passed/failed/else) ──
  expect(await page.locator('[data-id="decision_1"] .react-flow__handle').count()).toBe(4);
  await expect(page.locator('[data-id="decision_1"] [data-handleid="in"]')).toBeAttached();
  await expect(page.locator('[data-id="decision_1"] [data-handleid="port:passed"]')).toBeAttached();
  await expect(page.locator('[data-id="decision_1"] [data-handleid="port:failed"]')).toBeAttached();
  await expect(page.locator('[data-id="decision_1"] [data-handleid="port:else"]')).toBeAttached();

  // ── Card content ──
  await expect(page.locator('[data-id="decision_1"]').getByText('If / else').first()).toBeVisible();
  await expect(page.locator('[data-id="agent_1"]').getByText('Agent', { exact: true })).toBeVisible();
  await expect(page.locator('[data-id="agent_1"]').getByText('agent_1')).toBeVisible();

  // No legacy midpoint <select> anywhere on the canvas.
  expect(await page.locator('.react-flow__edges select').count()).toBe(0);

  // ── Default layout: End sits to the right of Start ──
  const startBox = await page.locator('[data-id="__start__"]').boundingBox();
  const endBox = await page.locator('[data-id="__end__"]').boundingBox();
  expect(startBox).toBeTruthy();
  expect(endBox).toBeTruthy();
  expect(endBox!.x).toBeGreaterThan(startBox!.x);
});
