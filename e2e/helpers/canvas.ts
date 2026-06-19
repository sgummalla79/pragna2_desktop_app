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

/**
 * A node's position in FLOW space — read from its own CSS `transform`
 * (`translate(x, y)`), which React Flow sets in graph coordinates, independent
 * of the viewport pan/zoom. Use this (not `boundingBox()`, which is SCREEN
 * space) to assert that dragging one node didn't move another: React Flow
 * auto-pans the viewport while a node is dragged near an edge
 * (`autoPanOnNodeDrag`), which shifts every OTHER node's screen pixels even
 * though its graph position is unchanged (tracker #139).
 */
export async function nodeFlowPosition(
  page: Page,
  nodeId: string,
): Promise<{ x: number; y: number }> {
  return page
    .locator(`.react-flow__node[data-id="${nodeId}"]`)
    .evaluate((el) => {
      const t = (el as HTMLElement).style.transform || getComputedStyle(el as HTMLElement).transform;
      // Inline form: "translate(123px, 45px)" / "translate3d(123px, 45px, 0px)".
      const tr = /translate(?:3d)?\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(t);
      if (tr) return { x: parseFloat(tr[1]), y: parseFloat(tr[2]) };
      // Computed form: "matrix(a, b, c, d, e, f)" → e,f are translate x,y.
      const mx = /matrix\(([^)]+)\)/.exec(t);
      if (mx) {
        const p = mx[1].split(',').map((n) => parseFloat(n.trim()));
        return { x: p[4], y: p[5] };
      }
      return { x: NaN, y: NaN };
    });
}

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
