# Feature Spec: Agent Flows (list + CRUD + interactive visual editor)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

**Agent Flows** lets a user manage multi-agent **flows** — node/edge pipelines of LLM-agent and
deterministic (MCP-connector / decision / knowledge-library) nodes that can be exposed as `/slash`
commands in chat. This is the `/settings/flows` route (list) + `/settings/flows/:flowId` (editor).

Shipped in two phases on one branch:
- **Phase 1** — list / create / delete flows, slash-exposure toggle, and the flow data layer.
- **Phase 2** — the **interactive visual editor**: add nodes from a palette, drag to position,
  connect/delete edges, edit each node's fields in a side panel, and Save (serialized to YAML,
  validated server-side, persisted by id). The graph round-trips through YAML, so positions and all
  node/edge fields survive a save.

## 2. Goals & Non-Goals

**Goals**
- [ ] List the user's flows with node/edge counts and enabled/slash state.
- [ ] Create a flow (display name + kebab api_name) and open it in the editor.
- [ ] Delete a flow (confirmed); toggle slash exposure + set the `/slash` name (kebab-validated).
- [ ] Add nodes from a palette (agent / decision / MCP connector / knowledge / end), drag to
      position, connect nodes, and delete nodes/edges on the canvas.
- [ ] Edit a selected node in a side panel — agent (id, display name, model, system prompt, tools,
      emits), decision (conditions), connector (pick MCP connectors + per-tool subset), knowledge
      (pick libraries) — and a selected edge's routing condition.
- [ ] **Save**: serialize the canvas to YAML, validate server-side (errors shown by path), and
      persist by flow id; node positions + all fields round-trip through the YAML.
- [ ] **Editor meta bar** (FEAT-003): edit the flow **description** (required by the backend before
      slash-exposure), toggle **Expose as /slash** + set the slash name inline, **enable/disable**
      the flow (immediate), and **import / export YAML** — all from the editor's top bar.
- [ ] **Full-page editor** (FEAT-003): the editor fills the whole window (covers the settings
      sidebar), matching the agent create/edit form's full-page treatment; its header clears the
      macOS overlay traffic lights (CF-019).

**Non-Goals (deferred — see §6)**
- A standalone **live editable YAML / source** view (the web app's is read-only too — not a parity
  item). **Import/export of YAML is shipped** (FEAT-003): import replaces the canvas, export
  downloads `<api_name>.yaml`. UI for node **reducers** is still deferred (web app has no UI either;
  data round-trips).
- Running a flow / slash dispatch / HITL forms in chat (deferred — pragna2-tracker TD-013, pragna2-tracker TD-014).

> **Now shipped (pragna2-tracker TD-021, 2026-06-10):** dynamic-dispatch fan-out editing
> (`dispatch_mode`/`items_slot`/`item_slot`) in the EdgePanel and connector
> **inline-register** in the ConnectorPanel. Context-slot inputs/outputs editing
> was already present. See §3/§6.

## 3. User Flows

**Create + author**
1. Settings → Agent Flows → **New flow** → enter display name (api_name auto-seeds, editable) →
   Create. Navigates to the **full-page** flow editor.
2. In the editor, set the **Description** in the meta bar (required before slash-exposure), author
   the graph on the canvas (or **Import** a YAML document to replace it), then **Save** (serialize →
   validate → persist; path-tagged errors shown inline). **Export** downloads the flow as YAML.

**Manage**
- Toggle **Expose as /slash** in the editor meta bar (set the slash name first) — or from the flow
  card in the list. The backend requires a non-empty description first; an inline hint nudges the
  user.
- Toggle **Enabled** in the editor meta bar to load/unload the flow from the runtime (immediate).
- **Delete** a flow from its card (confirmed).

## 4. Acceptance Criteria

- [ ] The list shows each flow's name, api_name, node/edge counts, enabled badge, and slash state.
- [ ] Creating a flow with a duplicate api_name shows a clear "already exists" message (no crash).
- [ ] The editor renders agent / decision / connector / knowledge nodes with their colors and
      Start/End boundaries, with condition-labelled, condition-colored edges.
- [ ] Adding a node from the palette, dragging it, connecting/deleting edges, and editing node
      fields all update the canvas; **Save** persists and an invalid graph surfaces server errors
      by path (save skipped).
- [ ] A saved flow reopens with its node positions + fields intact (YAML round-trip).
- [ ] Exposing a flow without a description (backend requirement) surfaces the backend's message;
      a slash-name collision shows "already exists". The editor meta bar lets the user **set** that
      description (FEAT-003) and shows an inline "description required" hint when exposing without one.
- [ ] The editor meta bar edits the description (Save-gated via YAML), toggles enable/disable
      (immediate PATCH), and imports/exports YAML (import replaces the canvas + marks dirty; export
      downloads `<api_name>.yaml`). (FEAT-003)
- [ ] The editor is a full-page surface covering the settings sidebar; its header clears the macOS
      traffic lights (FEAT-003 / CF-019).
- [ ] All flows surfaces remain usable narrow → wide (grid reflows; editor canvas + side panel
      adapt).

## 5. UI / Theming

- Theme tokens only; node/edge colors kept as-is from the web app (agent sky, decision amber,
  connector violet, knowledge teal, start emerald, end rose). Icons are lucide.
- Canvas via reactflow@11 (editable: drag/connect/delete + pan/zoom) with dagre seed layout; graph
  ⇄ YAML serialization via `js-yaml`. reactflow's base stylesheet is imported once in the editor
  (functional layout CSS, not theming).

## 6. Deferred Scope

**Shipped (pragna2-tracker TD-021, 2026-06-10):** dynamic-dispatch fan-out editing (a "Send per item" toggle +
items-slot / item-slot dropdowns in the EdgePanel, gated by the same source-must-be-agent /
not-already-branching / concrete-target rules as the web app) and connector **inline-register**
(the add-connector dialog now offers "Register a new connector", which opens the shared
`AddConnectorWizard` and attaches the result to the node). Context-slot **inputs/outputs** editing
was already present in the NodePanel.

**Still deferred (not parity gaps — the web app has no UI for these either):** a standalone editable
YAML/source view (the web app's YAML view is read-only) and a node **reducers** editor; both only
round-trip through YAML. Chat coupling — **slash dispatch** (pragna2-tracker TD-013) and **HITL episodes**
(pragna2-tracker TD-014) — reuses this flow layer. See `docs/web-app-parity.md` for the connector-register UI
deviation (desktop reuses its wizard vs. the web app's inline form).
