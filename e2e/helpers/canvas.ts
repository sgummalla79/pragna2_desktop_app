/**
 * Canvas-driving tricks for React Flow under Playwright, ported from the web
 * app's `e2e/helpers/canvas.ts` and adapted to the desktop flow editor.
 *
 * The desktop editor uses the classic `reactflow` package (v11) — but the DOM
 * classes (`.react-flow__node[data-id=...]`,
 * `.react-flow__handle[data-handleid=...]`) are identical to @xyflow/react, so
 * the selectors below carry over verbatim. Two non-obvious workarounds the web
 * suite discovered still apply:
 *
 *  1. Side handles are faint (opacity-30) until the parent node is hovered,
 *     which makes Playwright's `.hover()` actionability check unreliable. Work
 *     around it by moving the mouse raw (`page.mouse.move`) over the node
 *     centre and grabbing the handle's boundingBox while hovered.
 *
 *  2. Cascaded nodes overlap; `.click()` (even forced) loses to React Flow's
 *     own pointer hit-test. Use `dispatchEvent('click')` so React Flow's
 *     `onNodeClick` reads the right `event.target`.
 *
 * The desktop NodePanel uses `#np-node-id` for the agent-id field (verified in
 * NodePanel.tsx) — same as the web app — so `openPanelFor` checks it 1:1.
 */
import type { Page } from '@playwright/test';

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

/** Reveal a node's handles (hover-trigger) and return one handle's box. */
export async function revealAndGetHandle(
  page: Page,
  nodeId: string,
  side: HandleSide,
) {
  const nodeBox = await page.locator(`.react-flow__node[data-id="${nodeId}"]`).boundingBox();
  if (!nodeBox) throw new Error(`node ${nodeId} not found on canvas`);
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2);
  await page.waitForTimeout(250); // wait for opacity-30 → 100 transition
  const handleBox = await page
    .locator(`.react-flow__node[data-id="${nodeId}"] .react-flow__handle[data-handleid="${side}"]`)
    .boundingBox();
  if (!handleBox) throw new Error(`handle ${side} on ${nodeId} not found`);
  return handleBox;
}

/** Draw a connector from one node's side handle to another's. */
export async function dragSide(
  page: Page,
  src: { nodeId: string; side: HandleSide },
  dst: { nodeId: string; side: HandleSide },
): Promise<void> {
  const s = await revealAndGetHandle(page, src.nodeId, src.side);
  const d = await revealAndGetHandle(page, dst.nodeId, dst.side);
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  // intermediate move so React Flow's connection line picks up the drag
  await page.mouse.move(s.x + s.width / 2 + 20, s.y + s.height / 2 + 20, { steps: 4 });
  await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** Select a specific agent node + open its NodePanel (z-index-safe). */
export async function openPanelFor(page: Page, nodeId: string): Promise<void> {
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).dispatchEvent('click');
  await page.waitForTimeout(200);
  const opened = await page.locator('#np-node-id').inputValue();
  if (opened !== nodeId) {
    throw new Error(`openPanelFor(${nodeId}) opened panel for "${opened}"`);
  }
}
