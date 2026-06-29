# Technical Spec: FlowBuilder — Citations node

> **Status**: Implemented (Tier 2)
> **Author**: Suman Gummalla
> **Created**: 2026-06-29
> **Last Updated**: 2026-06-29
> **Feature Spec**: [features/flowbuilder-citations-node.md](../features/flowbuilder-citations-node.md)

---

## 1. Architecture & Approach

The visual FlowBuilder models each node kind by a React Flow node `type`, a
typed data shape, a canvas renderer, a palette entry, an optional property
panel, store actions, and graph↔YAML (de)serialization. Adding a node kind means
extending each of those seams. The Citations node mirrors the **Knowledge** node
(the simplest existing deterministic, pass-through node) at every seam, with one
addition the others don't need: a per-node **single in-edge** connection rule.

All editing is in-memory (Zustand store); nothing persists until Save, which
serializes the graph to YAML and POSTs to `/api/flows[/{id}]/from-yaml`. The BE
owns hard validation (slots produced upstream, no model/tools on the node, etc.)
and returns structured 422s — the FE does not duplicate that.

BE contract (nexus-kit-api `docs/architecture/flow-system.md` §Citations):
`node_kind: citations`; optional `sources_slot` (default `sources`), `draft_slot`
(default `draft`), `output_slot` (default `cited_report`); one in-edge, one
out-edge; no model/tools/emits/connectors/libraries/conditions.

## 2. Data Model (`editorTypes.ts`)

```ts
/** React Flow node `type` discriminator for the Citations node. */
export const NODE_TYPE_CITATIONS = 'citations';
/** The BE `node_kind` value a Citations node serialises to. */
export const NODE_KIND_CITATIONS = 'citations';

/** Canonical BE defaults shown as panel placeholders; omitted from YAML when
 *  blank so the BE applies them. Referenced by name, never inlined. */
export const CITATIONS_DEFAULT_SOURCES_SLOT = 'sources';
export const CITATIONS_DEFAULT_DRAFT_SLOT = 'draft';
export const CITATIONS_DEFAULT_OUTPUT_SLOT = 'cited_report';

/** Data carried by a Citations node. Slot names are OPTIONAL (blank ⇒ BE
 *  default). Deterministic: no agent, model, or conditions. */
export interface CitationsNodeData {
  nodeId: string;        // YAML api_name; unique within the flow
  sourcesSlot?: string;  // accumulated source list (default `sources`)
  draftSlot?: string;    // synthesis draft with [[marker]]s (default `draft`)
  outputSlot?: string;   // resolved report destination (default `cited_report`)
}
```

The `newFlowGraph()` node-union and the `EditorNode` unions in the store,
`graphToYaml`, and `buildEditorGraph` all gain `| CitationsNodeData`.

## 3. Canvas & Palette

- **`canvasNodes.tsx`** — `VISUAL_CITATIONS` (cyan tile, `Quote` icon) +
  `CitationsNode({ selected })`: a `MinimalCard` with one `target` handle (`in`,
  left) and one `source` handle (`out`, right) — identical shape to the Knowledge
  / Connector cards. Registered in `FLOW_NODE_TYPES` under key `citations`.
- **`PalettePanel.tsx`** — `PaletteKey` gains `'citations'`; a palette entry
  (cyan / Quote) is added before `end`; `onAdd` dispatches to `addCitationsNode`.

## 4. Property Panel (`CitationsPanel.tsx`)

```ts
export function CitationsPanel(): JSX.Element | null
```
Renders only when the selected node is a citations node (returns `null`
otherwise), so it can be mounted unconditionally alongside the other panels in
`FlowEditor`. Three `Input`s bound to `sourcesSlot` / `draftSlot` / `outputSlot`,
each with its default as placeholder. The shared patch helper:

```ts
// A blank field clears the slot (undefined) so the YAML omits it and the BE
// falls back to its default — never persist an empty string.
const patch = (key, value) =>
  updateCitationsFields(nodeId, { [key]: value.trim() === '' ? undefined : value });
```
Plus a delete-with-confirm dialog (mirrors `KnowledgePanel`). Wired into
`FlowEditor.tsx`: imported, rendered as `{selectedNodeId && <CitationsPanel />}`,
and `NODE_TYPE_CITATIONS` added to `handleNodeClick`'s panel-bearing set.

## 5. Store actions (`useFlowEditorStore.ts`)

```ts
/** Allocate a `citations_N` id not already used on the canvas. */
function nextCitationsNodeId(nodes: EditorNode[]): string

/** Add a deterministic Citations node at a position; selects it; marks dirty.
 *  Slot fields start unset (BE defaults apply until overridden). Returns id. */
addCitationsNode: (position: { x: number; y: number }) => string

/** Patch the optional slot fields on a Citations node. Passing `undefined`
 *  for a key clears that slot. Marks dirty. */
updateCitationsFields: (nodeId: string, patch: Partial<CitationsNodeData>) => void
```

## 6. Serialization

**`graphToYaml.ts`**
```ts
/** One `flow.nodes:` entry for a Citations node. Each slot is omitted when
 *  blank so the BE applies its default; the node carries nothing else. */
function citationsNodeEntry(data: CitationsNodeData): Record<string, unknown>
// → { api_name, node_kind: 'citations', [sources_slot], [draft_slot], [output_slot] }
```
Citations nodes are filtered out alongside the other kinds and spread into
`flow.nodes`. Positions/edges are handled by the existing generic paths (a
citations node is an ordinary graph node for layout + edges).

**`buildEditorGraph.ts`** — `RawNode` gains `sources_slot` / `draft_slot` /
`output_slot`. A `node_kind === NODE_KIND_CITATIONS` branch (placed before the
decision branch) builds `CitationsNodeData`, copying only present slot keys, so a
blank slot round-trips back to `undefined` (not `''`).

## 7. Connection rule (`connectionRules.ts`)

```ts
export function isValidFlowConnection(
  edges: Edge[],
  conn: Connection,
  excludeEdgeId: string | null = null,
  singleInEdgeNodeIds: ReadonlySet<string> = EMPTY_NODE_IDS,
): boolean
```
A new optional `singleInEdgeNodeIds` parameter lists node ids that accept at most
one inbound edge. The rule: if `target ∈ singleInEdgeNodeIds` and any existing
edge (other than `excludeEdgeId`) already targets it, reject. `excludeEdgeId`
keeps reconnect-dragging the existing in-edge valid. The set is **data-driven** —
`FlowEditor`'s `isValidConnection` computes it each call from the live nodes
(`nodes.filter(type === NODE_TYPE_CITATIONS)`), so the rule module stays free of
node-kind coupling and the rule extends to any future single-in-edge kind.

## 8. Data flow

```
Palette click → addCitationsNode(pos) → store node {type: citations, data:{nodeId}}
  → CitationsNode renders (1 in / 1 out) ; select → CitationsPanel edits slots
  → draw edge into node → isValidConnection(…, singleInEdgeNodeIds) gate
Save → graphToYaml → { node_kind: citations, [slots] } → POST /from-yaml (BE validates)
Reload → buildEditorGraph(definition) → citations node + slots restored
```

## 9. Error handling

- No new network or platform calls; nothing to swallow. Invalid graphs (e.g. a
  slot not produced upstream) are caught by the BE on Save and surfaced via the
  existing `FlowYamlErrors` 422 path — unchanged.
- The single-in-edge rule fails *closed* at draw time (returns `false`), so an
  invalid second in-edge can't enter the model in the first place.

## 10. Testing

- `connectionRules.test.ts` — single-in-edge: first allowed, second blocked,
  non-citations unaffected, reconnect via `excludeEdgeId`, fan-OUT still allowed.
- `graphToYaml.test.ts` — round-trip with overridden slots; blank slots omitted
  and round-trip to `undefined`.
- `useFlowEditorStore.test.ts` — `addCitationsNode` (id, type, select, dirty),
  id non-collision, `updateCitationsFields` (set + clear).
- `CitationsPanel.test.tsx` — null for non-citations selection; placeholders =
  defaults; reflects overrides; writes typed value; clears to undefined; delete.
- e2e (`e2e/tests/flow-citations-node.spec.ts`) — add from palette, edit a slot,
  Save, reload, assert persistence; verified against the Docker `nexus-kit-api`.
