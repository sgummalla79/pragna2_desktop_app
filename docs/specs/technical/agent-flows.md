# Technical Spec: Agent Flows (list + CRUD + interactive editor)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

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
  `updateSlashExposure`. Registered as `flowService` in the DI container.
- **`FlowRepository`** (axios) — endpoints under `/api`: `GET/POST /flows`, `GET/DELETE /flows/{id}`,
  `POST /flows/validate-yaml`, `POST /flows/from-yaml`, `PUT /flows/{id}/from-yaml`,
  `PATCH /flows/{id}/slash-exposure`. `mappers/mapFlow.ts` does snake_case ↔ camelCase for
  flow/node/edge.

## 3. Hooks (react-query)

`hooks/flows/useFlows.ts`: `useFlows` (`['flows']`), `useFlow(id)` (`['flows', id]`), `useCreateFlow`,
`useDeleteFlow`, `useValidateFlowYaml`, `useSaveFlowFromYaml`, `useSaveFlowFromYamlById`,
`useUpdateFlowSlashExposure`. Mutations invalidate `['flows']` (+ `['flows', id]`); the YAML-save and
slash-exposure mutations also invalidate `['pragna','flows']` (reserved for the deferred chat slash
popover — harmless no-op until then).

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
  read-only per-item chip when dynamic dispatch is set).
- **Panels:** `PalettePanel` (add nodes), `NodePanel` (agent fields; model select from `useModels`
  filtered `availableForFlows && enabled && !archived`, storing `model.modelName`; emits via the
  reused `AgentsView/ChipInput`; the **tools** chip passes `suggestions` from `useTools()` enabled
  `api_name`s → autocomplete dropdown + an "not in your tools" flag on unknown chips, free-form
  still allowed — TD-010), `DecisionPanel` (conditions), `ConnectorPanel`
  (`useMcpConnectors` + per-tool subset via `useTools`), `KnowledgePanel` (`useKnowledgeLibraries`),
  `EdgePanel` (condition select + delete).
- **`FlowEditor.tsx`** — `FlowEditor({ flow })`: hydrates the store from `buildEditorGraph(
  flow.definition)` (or `newFlowGraph()` + meta from the flow when empty) on mount and `reset()`s on
  unmount; renders `ReactFlow` (`ReactFlowProvider`, `ConnectionMode.Loose`) wired to the store
  (`onNodesChange`/`onEdgesChange`/`onConnect`/`isValidConnection`), the palette, and the selection
  panel; **Save** serializes via `graphToYaml`, runs `useValidateFlowYaml` (errors shown by path,
  save skipped if invalid), then `useSaveFlowFromYamlById` and `markClean`. Imports
  `reactflow/dist/style.css`.

## 5. Presentation

- **`FlowsView`** — header + `NewFlowDialog` + responsive grid of `FlowCard`s.
  - `NewFlowDialog` (shadcn `Dialog`): display name + kebab api_name (seeded via `slugify`,
    `^[a-z][a-z0-9-]*$`), `useCreateFlow`, navigates to detail; 409 → "already exists".
  - `FlowCard`: name/api_name, node/edge counts, enabled badge, an inline **slash-exposure** row
    (`useUpdateFlowSlashExposure`; surfaces backend `detail` / 409), and a confirmed delete
    (`ConfirmButton` + `useDeleteFlow`).
- **`FlowDetailView`** (`/settings/flows/:flowId`) — a compact header (name + status/slash badges)
  over `<FlowEditor flow={flow} />` (§4), which fills the remaining height.
- **Routing:** `routes.ts` `SETTINGS_FLOW_DETAIL`; `AppRoutes.tsx` swaps the flows `PlaceholderView`
  for `FlowsView` + the nested detail route inside the Settings layout.

## 6. Error handling

New catalog codes `FLW_001`–`FLW_008`. Views prefer the backend `detail` then fall back to the
catalog message; create/slash collisions (409) map to `FLW_007`, invalid kebab to `FLW_008`. Mutations
log via `logger.fromError` on failure.

## 7. Dependencies

`reactflow@^11.11.4`, `dagre@^0.8.5` (+ `@types/dagre`), `js-yaml@^4` (+ `@types/js-yaml`),
`@uiw/react-codemirror@^4.25.10`, `@codemirror/lang-yaml@^6.1.3`, `zustand` (already present).

## 8. Deferred / known gaps (docs/TODO.md)

`TD-020` (interactive editor) — **done** here. `TD-021` — editing UI for dynamic-dispatch fan-out +
context slots (data already round-trips), an editable YAML/source view, and connector inline-register.
`TD-013`/`TD-014` (chat slash dispatch + HITL episodes) are unblocked by this flow layer. Unit tests
for the new repo/mappers/hooks/store/serialization fold into `TD-003`. Live end-to-end requires the
running backend + a valid Auth0 token.
