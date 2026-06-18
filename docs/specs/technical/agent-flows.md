# Technical Spec: Agent Flows (list + CRUD + interactive editor)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-17

---

## 1. Architecture

Follows the app's clean-architecture layering:

```
domain/types/flow.types.ts + flowYaml.types.ts
  → application/ports/IFlowRepository.ts
  → application/services/FlowService.ts
  → infrastructure/repositories/FlowRepository.ts (+ mappers/mapFlow.ts)
  → presentation/hooks/flows/useFlows.ts + presentation/views/settings/{FlowsView,FlowDetailView}/*
```

**Source of truth = YAML.** The backend's structured `nodes[]`/`edges[]` omit connector lists,
library lists, and decision conditions (those live only in `flow.definition`). So the editor uses
the **YAML as the source of truth**: `buildEditorGraph(definition)` parses it into an editor model
(nodes with dagre/persisted positions, edges, meta), the user edits via a zustand store, and
`graphToYaml(meta, nodes, edges)` serializes back. Because both functions carry every field
(positions, slots, dispatch, connectors, libraries, conditions, output_schema), a Save round-trips
losslessly even for fields with no editing UI.

## 2. Data layer

- **`flow.types.ts`** — `Flow`, `FlowNode` (`nodeKind: null|'mcp_connector'|'decision'|
  'knowledge_library'`), `FlowEdge`, `EdgeCondition`, `CreateFlowPayload`,
  `UpdateFlowSlashExposurePayload`. **`flowYaml.types.ts`** — `YamlError`, `YamlValidationResult`.
- **`constants/edgeConditions.ts`** — condition values, labels, and theme-token color map.
- **`IFlowRepository` / `FlowService`** — `list`, `get`, `create`, `delete`, `validateYaml`,
  `saveFromYaml` (POST, idempotent by api_name), `saveFromYamlById` (PUT, by id, supports rename),
  `updateFlow` (PATCH flow-level fields outside the YAML graph — FEAT-003), `updateSlashExposure`.
  Registered as `flowService` in the DI container.
- **`FlowRepository`** (axios) — endpoints under `/api`: `GET/POST /flows`, `GET/DELETE /flows/{id}`,
  `POST /flows/validate-yaml`, `POST /flows/from-yaml`, `PUT /flows/{id}/from-yaml`,
  `PATCH /flows/{id}` (`updateFlow`: sends only the provided `display_name`/`description`/`enabled`),
  `PATCH /flows/{id}/slash-exposure`. `mappers/mapFlow.ts` does snake_case ↔ camelCase for
  flow/node/edge. `UpdateFlowPayload` (domain) carries the optional flow-level fields.

## 3. Hooks (react-query)

`hooks/flows/useFlows.ts`: `useFlows` (`['flows']`), `useFlow(id)` (`['flows', id]`), `useCreateFlow`,
`useDeleteFlow`, `useValidateFlowYaml`, `useSaveFlowFromYaml`, `useSaveFlowFromYamlById`,
`useUpdateFlow` (FEAT-003 — flow-level fields, used by the enable/disable toggle),
`useUpdateFlowSlashExposure`. Mutations invalidate `['flows']` (+ `['flows', id]`); the YAML-save,
`updateFlow`, and slash-exposure mutations also invalidate `['pragna','flows']` (the chat slash
popover — enabling/exposing changes which flows it can run).

## 4. Interactive editor (`FlowDetailView/`)

The editor is a faithful port of the web app's `FlowEditorView`, adapted to our theme + shadcn
primitives. Files:

- **Core logic (pure TS, ported near-verbatim):** `editorTypes.ts` (editor-model types +
  constants + `blankAgent`/`newFlowGraph`/port helpers), `connectionRules.ts`
  (`isValidFlowConnection`), `yamlToGraph.ts` (dagre layout seed), `buildEditorGraph.ts`
  (YAML → `{ meta, nodes, edges }`), `graphToYaml.ts` (`{ meta, nodes, edges }` → YAML, incl.
  `metadata.positions` / `edge_handles` / `end_routing`), and **`useFlowEditorStore.ts`** — the
  zustand store (state: `meta`, `nodes`, `edges`, `selectedNodeId`, `selectedEdgeId`, `dirty`,
  `reconnectingEdgeId`; actions: hydrate/reset/markClean/markDirty, `onNodesChange`/`onEdgesChange`/
  `onConnect`/`onReconnect`, add*/delete/select for nodes + edges, and field updaters
  `updateAgent`/`updateConnectors`/`updateLibraries`/`updateConditions`/`setEdgeCondition`).
- **Rendering:** `canvasNodes.tsx` (`FLOW_NODE_TYPES`: agent/decision/connector/knowledge/boundary,
  off the `*NodeData` shapes; decision exposes one `port:<condition>` source per row + `else`),
  `ConditionEdge.tsx` (`FLOW_EDGE_TYPES.condition`: selectable bezier, condition label/color, a
  per-item chip when dynamic dispatch is set — now editable from the EdgePanel, see below).
- **Panels:** `PalettePanel` (add nodes), `NodePanel` (agent fields; model select from `useModels`
  filtered `availableForFlows && enabled && !archived`, storing `model.modelName`; emits via the
  reused `AgentsView/ChipInput`; the **tools** chip passes `suggestions` from `useTools()` enabled
  `api_name`s → autocomplete dropdown + an "not in your tools" flag on unknown chips, free-form
  still allowed — pragna2-tracker TD-010), `DecisionPanel` (conditions), `ConnectorPanel`
  (`useMcpConnectors` + per-tool subset via `useTools`; the add dialog also offers **inline
  register** — "Register a new connector" opens the shared `ConnectorsView/AddConnectorWizard`,
  whose new `onRegistered(connector)` callback fires on successful create and the panel attaches it
  to the node — pragna2-tracker TD-021), `KnowledgePanel` (`useKnowledgeLibraries`),
  `EdgePanel` (condition select + **dynamic fan-out**: a "Send per item" toggle writing
  `dispatchMode`/`itemsSlot`/`itemSlot` via `updateEdgeData` all-or-none, items-slot options =
  source `outputs` + `SLOT_USER_QUERY`, item-slot options = target `inputs`, gated when the source
  isn't an agent / already branches via `emits` / the target is a boundary or `__end__` — pragna2-tracker TD-021;
  + delete).
- **`FlowEditor.tsx`** — `FlowEditor({ flow })`: hydrates the store from `buildEditorGraph(
  flow.definition)` (or `newFlowGraph()` + meta from the flow when empty) on mount and `reset()`s on
  unmount; renders the **`FlowMetaBar`** (top), `ReactFlow` (`ReactFlowProvider`,
  `ConnectionMode.Loose`) wired to the store
  (`onNodesChange`/`onEdgesChange`/`onConnect`/`isValidConnection`), the palette, and the selection
  panel; **Save** serializes via `graphToYaml`, runs `useValidateFlowYaml` (errors shown by path,
  save skipped if invalid), then `useSaveFlowFromYamlById` and `markClean`. Imports
  `reactflow/dist/style.css`.
- **`FlowMetaBar.tsx`** — the editor's top control bar. Top row: **flow identity** (EntityIcon +
  display name + api_name pill + `/slash` pill + **Unsaved/Saved pill** — amber when dirty, green
  when clean). Second row: **graph meta** controls all `items-center` aligned — Description input
  (placeholder-only, Save-gated via YAML round-trip), Expose-as-/slash checkbox, Slash name input
  (when exposed), and the right-cluster (Import / Export / YAML buttons from `FlowYamlActions`).
  Inline hints for missing description and invalid slash name. **Enabled/Disabled** removed from
  this bar — it lives on the flow card on the main list (not duplicated here). No `useUpdateFlow`
  dependency.
- **`FlowYamlActions.tsx`** — three Sheet flyouts: **Import** (drag-and-drop zone with
  drag-over highlight + "Choose file…" button + paste textarea; `buildEditorGraph` → `hydrate` +
  `markDirty`; malformed → inline `FLW_010` alert); **Export** (direct download — `graphToYaml` →
  Blob → `<api_name>.yaml`, fallback `agentic-flow`); **YAML** (read-only view of the serialised
  canvas + Download button). Both sheets use `z-[400]` / `overlayClassName="z-[399]"` to sit above
  the `z-[300]` full-page editor surface. Self-contained: reads/writes store directly.
- **`FlowEditor.tsx`** footer — **Save / Cancel** buttons in a `border-t px-6 py-4` footer row
  matching the Agent form pattern. Save: `graphToYaml` → `useValidateFlowYaml` (errors shown by
  path, skip if invalid) → `useSaveFlowFromYamlById` → `markClean`. Cancel: `reset()` + `navigate(
  ROUTES.SETTINGS_FLOWS)`. `isSaving` gates the Save button (disabled when clean or in-flight).
- **`sheet.tsx`** — added `overlayClassName?: string` prop to `SheetContent` so callers can
  override the overlay's z-index when the sheet must appear above a high-z page surface.

## 5. Presentation

- **`FlowsView`** — header + `NewFlowDialog` + responsive grid of `FlowCard`s.
  - `NewFlowDialog` (shadcn `Dialog`): display name + kebab api_name (seeded via `slugify`,
    `^[a-z][a-z0-9-]*$`), `useCreateFlow`, navigates to detail; 409 → "already exists".
  - `FlowCard`: name/api_name, node/edge counts, enabled badge, an inline **slash-exposure** row
    (`useUpdateFlowSlashExposure`; surfaces backend `detail` / 409), and a confirmed delete
    (`ConfirmButton` + `useDeleteFlow`).
- **`FlowDetailView`** (`/settings/flows/:flowId`) — a **full-page** surface (FEAT-003): a
  `fixed inset-0 z-[300]` container covering the settings sidebar (matching `AgentFormModal`'s
  full-page treatment), with a single-row header (ghost icon back button + an "Edit <name>" title,
  mirroring the agent edit form — flows are always created first then opened here, so it's always
  "Edit"; the flow identity pills live in the FlowMetaBar) over `<FlowEditor flow={flow} />` (§4). The header reserves space for the
  macOS overlay traffic lights via `useOverlayTitleBarInset()` (CF-019), since it now sits at the
  window's top-left. **z-tier:** `z-[300]` is above the settings chrome it must hide — the macOS
  collapse toggle (`z-[70]`) and the Windows title bar (`z-[200]`) — but below the modal tier
  (`z-[700]`+) so dialogs the editor opens (connector wizard, confirm, Select) still layer on top.
  Loading/error/loaded states share the one full-page shell.
- **Routing:** `routes.ts` `SETTINGS_FLOW_DETAIL`; `AppRoutes.tsx` swaps the flows `PlaceholderView`
  for `FlowsView` + the nested detail route inside the Settings layout.

## 6. Error handling

New catalog codes `FLW_001`–`FLW_008`. Views prefer the backend `detail` then fall back to the
catalog message; create/slash collisions (409) map to `FLW_007`, invalid kebab to `FLW_008`. Mutations
log via `logger.fromError` on failure.

## 7. Dependencies

`reactflow@^11.11.4`, `dagre@^0.8.5` (+ `@types/dagre`), `js-yaml@^4` (+ `@types/js-yaml`),
`@uiw/react-codemirror@^4.25.10`, `@codemirror/lang-yaml@^6.1.3`, `zustand` (already present).

## 8. Deferred / known gaps (pragna2-tracker)

pragna2-tracker TD-020 (interactive editor) — **done** here. pragna2-tracker TD-021 — **done** for the parity gaps:
dynamic-dispatch fan-out editing (EdgePanel) and connector inline-register (ConnectorPanel reusing
`AddConnectorWizard`); context-slot inputs/outputs editing was already present (NodePanel). **Still
deferred (not parity gaps):** a standalone editable YAML/source view and a node `reducers` editor —
the web app has no UI for either; both round-trip through YAML.
pragna2-tracker TD-013/pragna2-tracker TD-014 (chat slash dispatch + HITL episodes) are unblocked by this flow layer. Unit tests
for the new repo/mappers/hooks/store/serialization fold into pragna2-tracker TD-003. Live end-to-end requires the
running backend + a valid Auth0 token.
