/**
 * High-level visual-editor authoring helpers, ported from the web app's
 * `e2e/helpers/flow-author.ts` and adapted to the desktop flow editor.
 *
 * Key desktop differences from the web app (reconciled against the desktop
 * source — no-hallucination rule):
 *
 *  - There is NO `/flows/new` route and NO header meta form. A flow is created
 *    FIRST (a `flows` row), then opened at `/settings/flows/:flowId` where the
 *    canvas is the only authoring surface. So instead of `fillFlowMeta`, this
 *    module exposes {@link seedFlow} (inserts a `flows` row directly + returns
 *    its UUID) and {@link openFlow} (navigates into the editor + waits for the
 *    palette). The editor seeds `meta` from the loaded flow row when its
 *    `definition` is empty (FlowEditor.tsx → newFlowGraph).
 *  - The Save button is gated on `dirty` — every authoring path drops a node
 *    or drags one first, which flips dirty.
 *  - There is no Validate button and no YAML "view source" dialog — Save runs
 *    validate-then-persist internally and renders a `role="status"` banner.
 *  - The desktop NodePanel field ids match the web app 1:1 (`#np-node-id`,
 *    `#np-agent-display`, `#np-agent-prompt`, `#np-agent-model`,
 *    `#np-agent-emits`, `#np-inputs`, `#np-outputs`) — verified in
 *    NodePanel.tsx.
 *  - `newFlowGraph()` auto-places only `__start__` (End is a palette drop),
 *    same as the current web app — so {@link placeEnd} is still needed.
 */
import { expect, type Page } from '@playwright/test';

import { psql } from './db';
import { MODEL_PICKER_LABEL, TEST_USER } from './env';

/** Logical palette kind → the actual palette button label. The router tile
 *  reads "If / else" on the canvas but we keep the logical name `Decision` at
 *  call sites (it drops a deterministic Decision node). */
const PALETTE_BUTTON: Record<
  'Agent' | 'Decision' | 'MCP' | 'Knowledge' | 'End',
  RegExp
> = {
  Agent: /^Agent$/,
  Decision: /^If \/ else$/,
  MCP: /^MCP$/,
  Knowledge: /^Knowledge$/,
  End: /^End$/,
};

/** Insert an empty `flows` row for the seeded test user and return its UUID.
 *  An empty `definition` makes the editor build a fresh Start-only canvas
 *  (FlowEditor.tsx). Caller owns cleanup (DELETE FROM flows WHERE api_name=…).
 *  `exposed_as_slash` defaults false so the flow can save without a slash name
 *  (the desktop editor never sets slash exposure — that lives on the card). */
export function seedFlow(opts: {
  apiName: string;
  displayName: string;
  description?: string;
}): string {
  const out = psql(
    `INSERT INTO flows (id, user_id, api_name, display_name, description, enabled, exposed_as_slash)
     VALUES (gen_random_uuid(),
             (SELECT id FROM users WHERE email='${TEST_USER.email}'),
             '${opts.apiName}', '${opts.displayName.replace(/'/g, "''")}',
             ${opts.description ? `'${opts.description.replace(/'/g, "''")}'` : 'NULL'},
             true, false)
     RETURNING id;`,
  );
  // Extract the UUID defensively (psql may emit command tags alongside the
  // returned row depending on stream buffering).
  const id = (out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) ?? [])[0];
  if (!id) throw new Error(`seedFlow: no id returned for ${opts.apiName} (got: ${out})`);
  return id;
}

/** Navigate into the flow editor and wait for the palette to render — anchors
 *  the rest of the spec on a fully-mounted editor. */
export async function openFlow(page: Page, flowId: string): Promise<void> {
  await page.goto(`/settings/flows/${flowId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('nav[aria-label="Add node"]');
}

/** Drop an Agent / Decision / MCP connector / Knowledge / End from the palette. */
export async function dropFromPalette(
  page: Page,
  label: 'Agent' | 'Decision' | 'MCP' | 'Knowledge' | 'End',
): Promise<void> {
  const palette = page.getByRole('navigation', { name: /add node/i });
  await palette.getByRole('button', { name: PALETTE_BUTTON[label] }).click();
  await page.waitForTimeout(150);
}

/** Set a Decision (router) node's condition rows to exactly `conditions`
 *  (clears the default [passed, failed] first). Opens the DecisionPanel by
 *  clicking the node, edits the rows, then closes the panel. The always-on
 *  `else` branch is implicit and not listed here. */
export async function setDecisionConditions(
  page: Page,
  nodeId: string,
  conditions: string[],
): Promise<void> {
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).dispatchEvent('click');
  await expect(page.getByTestId('decision-panel')).toBeVisible();
  // Remove every existing row (indices shift as we remove → re-query).
  while (true) {
    const removeBtn = page.getByRole('button', { name: /^Remove condition / });
    if ((await removeBtn.count()) === 0) break;
    await removeBtn.first().click();
  }
  // Add the new rows in order; each new row's input is aria-labelled
  // "Condition <n>".
  for (let i = 0; i < conditions.length; i += 1) {
    await page.getByTestId('decision-add-condition').click();
    await page.getByLabel(`Condition ${i + 1}`, { exact: true }).fill(conditions[i]);
  }
  await page.getByRole('button', { name: /close panel/i }).click();
}

/** Drop the End terminator onto the canvas and close any panel that opened.
 *  End is not auto-placed on a new flow — the author drags it out to wire the
 *  terminator (editorTypes.ts:newFlowGraph). The first End instance gets the
 *  id `__end__`; connect to it via `connectViaStore({ nodeId: '__end__' })`. */
export async function placeEnd(page: Page): Promise<void> {
  await dropFromPalette(page, 'End');
  const closeBtn = page.getByRole('button', { name: /close panel/i });
  if (await closeBtn.count()) await closeBtn.first().click();
}

/** Add an edge via the editor store directly — bypasses React Flow's drag
 *  mechanics, which are fragile on a crowded canvas. Equivalent to a user
 *  successfully drawing the connector: hits the store's `onConnect` action
 *  which runs the same validation + dedupe. Requires dev mode (Vite injects
 *  `window.__flowEditorStore` — see useFlowEditorStore.ts). */
export async function connectViaStore(
  page: Page,
  from: { nodeId: string; handleId: string },
  to: { nodeId: string; handleId: string },
): Promise<void> {
  await page.evaluate(
    ({ from, to }) => {
      const store = (window as unknown as {
        __flowEditorStore?: {
          getState: () => { onConnect: (c: unknown) => void };
        };
      }).__flowEditorStore;
      if (!store) {
        throw new Error('window.__flowEditorStore not exposed — run in dev mode');
      }
      store.getState().onConnect({
        source: from.nodeId,
        sourceHandle: from.handleId,
        target: to.nodeId,
        targetHandle: to.handleId,
      });
    },
    { from, to },
  );
  await page.waitForTimeout(100);
}

/** Click an agent node to open its NodePanel (z-index-safe). */
export async function openPanel(page: Page, nodeId: string): Promise<void> {
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).dispatchEvent('click');
  await page.waitForTimeout(200);
  const opened = await page.locator('#np-node-id').inputValue();
  if (opened !== nodeId) {
    throw new Error(`openPanel(${nodeId}) opened panel for "${opened}"`);
  }
}

/** Replace the `emits` chip set on the open NodePanel to exactly the provided
 *  list. Clears every existing chip first, then enters the new chips via
 *  fill + Enter. Caller is responsible for the panel being open. */
export async function setEmits(page: Page, emits: string[]): Promise<void> {
  while (true) {
    const removeBtn = page.getByRole('button', { name: /^Remove emit / });
    if ((await removeBtn.count()) === 0) break;
    await removeBtn.first().click();
  }
  for (const emit of emits) {
    await page.locator('#np-agent-emits').fill(emit);
    await page.locator('#np-agent-emits').press('Enter');
  }
}

/** Fill the NodePanel's standard chat-agent fields. The node id (=
 *  agent.api_name) is renamed first; the panel is assumed to be open on the
 *  just-dropped node. If `inputs` / `outputs` are given, the Context variables
 *  (#26) section is expanded and the chips entered. If `emits` is given, the
 *  emit chip set is replaced. Panel is closed on exit. */
export async function configureChatAgent(
  page: Page,
  opts: {
    nodeId: string;
    display: string;
    prompt: string;
    modelLabel?: RegExp;
    inputs?: string[];
    outputs?: string[];
    emits?: string[];
  },
): Promise<void> {
  const modelLabel = opts.modelLabel ?? MODEL_PICKER_LABEL;
  await page.locator('#np-node-id').fill(opts.nodeId);
  await page.locator('#np-node-id').blur();
  await page.locator('#np-agent-display').fill(opts.display);
  await page.locator('#np-agent-prompt').fill(opts.prompt);
  await page.locator('#np-agent-model').click();
  await page.getByRole('option', { name: modelLabel }).click();
  await page.waitForTimeout(150);

  if (opts.emits) {
    await setEmits(page, opts.emits);
  }

  if ((opts.inputs && opts.inputs.length) || (opts.outputs && opts.outputs.length)) {
    await page.locator('summary:has-text("Context variables")').click();
    if (opts.inputs?.length) {
      for (const slot of opts.inputs) {
        await page.locator('#np-inputs').fill(slot);
        await page.locator('#np-inputs').press('Enter');
      }
    }
    if (opts.outputs?.length) {
      for (const slot of opts.outputs) {
        await page.locator('#np-outputs').fill(slot);
        await page.locator('#np-outputs').press('Enter');
      }
    }
  }

  await page.getByRole('button', { name: /close panel/i }).click();
}

/** Click Save and wait for the success banner. */
export async function saveFlow(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByRole('status')).toContainText(/Created|Saved/, {
    timeout: 10_000,
  });
}
