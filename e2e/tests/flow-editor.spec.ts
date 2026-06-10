/**
 * Visual flow editor — core authoring + Save round-trip (desktop port of the
 * web app's `flow-editor.spec.ts`, items 1-10).
 *
 * Desktop adaptations vs the web app (reconciled against the desktop source):
 *  - There is NO `/flows/new` route and NO header meta form / YAML viewer /
 *    Validate button. A flow is seeded (a `flows` row) then opened at
 *    `/settings/flows/:flowId`; the editor seeds `meta` from that row and the
 *    canvas is the only authoring surface (FlowEditor.tsx, FlowDetailView.tsx).
 *  - The "view yaml source" assertions (#8) have no desktop equivalent —
 *    dropped (noted in the deferred list).
 *  - Edge creation uses `connectViaStore` (drives the store's `onConnect`,
 *    same reducer a successful drag fires) — robust on a cascaded canvas.
 *  - Save round-trip + prune are asserted directly against the throwaway DB.
 *
 * Auth comes from the seed-token `page` fixture (no login form). Each test
 * seeds its OWN flow row with a unique api_name so specs never collide.
 */
import { test, expect } from '../fixtures';
import { openPanelFor, revealAndGetHandle } from '../helpers/canvas';
import { db, psql } from '../helpers/db';
import { MODEL_PICKER_LABEL } from '../helpers/env';
import {
  connectViaStore,
  dropFromPalette,
  openFlow,
  seedFlow,
} from '../helpers/flow-author';

test.describe.configure({ mode: 'serial' }); // shared DB → run in order

const FLOW_API = 'e2e-fe-editor';
const FLOW_DISPLAY = 'E2E FE Editor';

test.describe('Visual flow editor', () => {
  let flowId: string;

  test.beforeEach(async ({ page }) => {
    // Clean only THIS spec's row (cascade clears its nodes/edges), then seed
    // a fresh empty flow and open it. Each test starts from a Start-only
    // canvas.
    psql(`DELETE FROM flows WHERE api_name LIKE 'e2e-fe-%';`);
    flowId = seedFlow({
      apiName: FLOW_API,
      displayName: FLOW_DISPLAY,
      description: 'e2e-verified flow.',
    });
    await openFlow(page, flowId);
  });

  test('#1 mounts with Start boundary node + palette (End is in the palette)', async ({ page }) => {
    await expect(
      page.locator('.react-flow__node[data-id="__start__"]').getByText(/^Start$/),
    ).toBeVisible();
    const palette = page.getByRole('navigation', { name: /add node/i });
    await expect(palette.getByRole('button', { name: /^Agent$/ })).toBeVisible();
    await expect(palette.getByRole('button', { name: /^If \/ else$/ })).toBeVisible();
    await expect(palette.getByRole('button', { name: /^End$/ })).toBeVisible();
    // Save button present (the desktop toolbar replaces the web YAML/Validate
    // header — Save is the only action here).
    await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible();
  });

  test('#2 four omni handles on an Agent are faint until node hover', async ({ page }) => {
    await dropFromPalette(page, 'Agent');
    const handle = page.locator('.react-flow__node[data-id="agent_1"] .react-flow__handle').first();
    // Desktop handle resting opacity is 0.3 (canvasNodes.tsx HANDLE_CLASS).
    expect(await handle.evaluate((el) => window.getComputedStyle(el).opacity)).toBe('0.3');
    await page.locator('.react-flow__node[data-id="agent_1"]').hover();
    await page.waitForTimeout(250);
    expect(
      Number(await handle.evaluate((el) => window.getComputedStyle(el).opacity)),
    ).toBeGreaterThan(0.8);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      await expect(
        page.locator(`.react-flow__node[data-id="agent_1"] .react-flow__handle[data-handleid="${side}"]`),
      ).toHaveCount(1);
    }
  });

  test('#3 dropping Agent from palette creates a node and opens the side panel', async ({ page }) => {
    await dropFromPalette(page, 'Agent');
    await expect(page.locator('.react-flow__node[data-id="agent_1"]')).toBeVisible();
    await expect(page.locator('#np-node-id')).toBeVisible();
    expect(await page.locator('#np-node-id').inputValue()).toBe('agent_1');
  });

  test('#7 node_id collision shows inline error and reverts the draft', async ({ page }) => {
    await dropFromPalette(page, 'Agent');
    await page.getByRole('button', { name: /close panel/i }).click();
    await dropFromPalette(page, 'Agent');
    // Panel is on agent_2; rename to agent_1 → collision.
    await page.locator('#np-node-id').fill('agent_1');
    await page.locator('#np-node-id').blur();
    await expect(page.getByRole('alert')).toContainText(/already uses/i);
    expect(await page.locator('#np-node-id').inputValue()).toBe('agent_2');
  });

  test('#5a self-loop is rejected at draw time (no edge created)', async ({ page }) => {
    await dropFromPalette(page, 'Agent');
    await page.getByRole('button', { name: /close panel/i }).click();
    const bottom = await revealAndGetHandle(page, 'agent_1', 'bottom');
    const top = await revealAndGetHandle(page, 'agent_1', 'top');
    await page.mouse.move(bottom.x + bottom.width / 2, bottom.y + bottom.height / 2);
    await page.mouse.down();
    await page.mouse.move(top.x + top.width / 2, top.y + top.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  });

  test('#4 + #5b + #9 + #10 — full authoring cycle through Save + prune', async ({ page }) => {
    await dropFromPalette(page, 'Agent');
    await page.getByRole('button', { name: /close panel/i }).click();
    await dropFromPalette(page, 'Agent');
    await page.getByRole('button', { name: /close panel/i }).click();

    // ── #4 edge create (right → left) via the store reducer ──
    await connectViaStore(
      page,
      { nodeId: 'agent_1', handleId: 'right' },
      { nodeId: 'agent_2', handleId: 'left' },
    );
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // ── #5b duplicate (source,target) blocked even when handles differ ──
    await connectViaStore(
      page,
      { nodeId: 'agent_1', handleId: 'bottom' },
      { nodeId: 'agent_2', handleId: 'top' },
    );
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // ── Configure both agents (model + prompt + display) ──
    for (const id of ['agent_1', 'agent_2'] as const) {
      await openPanelFor(page, id);
      await page.locator('#np-agent-display').fill(`Agent ${id}`);
      await page.locator('#np-agent-prompt').fill(`You are agent ${id}.`);
      await page.locator('#np-agent-model').click();
      await page.getByRole('option', { name: MODEL_PICKER_LABEL }).click();
      await page.waitForTimeout(150);
    }
    await page.getByRole('button', { name: /close panel/i }).click();

    // ── #9 Save round-trip ──
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('status')).toContainText(/Created|Saved/);

    expect(db.flowCount()).toBeGreaterThanOrEqual(1);
    // Both nodes carry an inline agent definition (non-NULL user_model_id).
    const agentRows = db.agentNodeCount();
    expect(agentRows).toBeGreaterThanOrEqual(2);
    const nodes = db.flowNodes(FLOW_API);
    expect(nodes.map((r) => r[0]).sort()).toEqual(['agent_1', 'agent_2']);

    // ── #10 Prune on resave (delete agent_2 + save) ──
    await openPanelFor(page, 'agent_2');
    await page.getByRole('button', { name: /delete agent/i }).first().click();
    await page
      .getByRole('dialog', { name: /delete this agent/i })
      .getByRole('button', { name: /^delete$/i })
      .click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('status')).toContainText(/Saved/);

    const nodesAfter = db.flowNodes(FLOW_API);
    expect(nodesAfter.map((r) => r[0])).toEqual(['agent_1']);
    expect(
      psql(
        "SELECT COUNT(*) FROM flow_nodes WHERE api_name='agent_2' " +
          `AND flow_id=(SELECT id FROM flows WHERE api_name='${FLOW_API}')`,
      ),
    ).toBe('0');
  });
});
