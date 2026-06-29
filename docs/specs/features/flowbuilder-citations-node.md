# Feature Spec: FlowBuilder — Citations node

> **Status**: Implemented (Tier 2)
> **Author**: Suman Gummalla
> **Created**: 2026-06-29
> **Last Updated**: 2026-06-29

---

## 1. Overview

The backend ships a deterministic `citations` flow node (BE #233): it reads an
accumulated **source list** and a synthesis **draft** that cites sources inline
with stable `[[<url-or-slug>]]` markers, then resolves those markers into
numbered `[n]` references and appends a `## References` section. It carries no
model/tools/conditions — three optional state-slot names are its entire config.

The desktop app authors flows visually (ReactFlow FlowBuilder: palette + canvas +
property panels), so this feature adds a first-class **Citations** node to that
builder — palette tile, canvas node, a property panel for the three slots, the
single-in-edge connection rule, and flow-YAML round-trip. Without it, an author
could only get a citations node by hand-editing raw YAML.

This is **Tier 2** of pragna2_desktop_app#99 (moved from nexus-kit-tracker #238).
Cross-repo follow-up to BE #233.

## 2. Goals & Non-Goals

**Goals**
- [x] Add a **Citations** palette entry that drops a citations node on the canvas.
- [x] Render the node as a deterministic pass-through card (one inbound, one
      outbound handle) with its own icon/colour (cyan / quote).
- [x] A property panel to edit the three optional slot names (`sources_slot`,
      `draft_slot`, `output_slot`); blank fields fall back to the BE defaults.
- [x] Enforce the BE contract that a citations node has **exactly one in-edge** —
      a second inbound edge can't be drawn on the canvas.
- [x] Serialize to / parse from flow YAML (`node_kind: citations`) so the node
      round-trips through save + reload and YAML import/export.

**Non-Goals**
- Rendering the resolved report — that's the chat surface (Tier 1, shipped).
- Validating that the slots are produced upstream, or that markers exist — the
  BE owns that hard validation and returns structured 422s on Save.
- Tier 3 inline `[n]` footnote backlinks (deferred).

## 3. User Flow

- Author opens a flow in the visual editor and clicks **Citations** in the
  palette → a citations node appears on the canvas, already selected.
- The right-side **Citations** panel shows three optional inputs
  (Sources / Draft / Output slot), each with its default as the placeholder.
- Author wires `synthesis-agent → citations → __end__`. Trying to draw a second
  edge *into* the citations node is rejected at draw time.
- On **Save** the node serializes to `node_kind: citations` (+ any overridden
  slots). Reopening the flow restores the node and its slot values.

## 4. Acceptance Criteria

- [x] The palette shows a **Citations** entry; clicking it adds a `citations_N`
      node and selects it.
- [x] The node renders with one target (left) and one source (right) handle.
- [x] Selecting the node opens the Citations panel; editing a slot updates the
      node; clearing it restores the placeholder/default.
- [x] A first inbound edge into the citations node is allowed; a **second** is
      blocked on the canvas (other node kinds still accept fan-in).
- [x] `graphToYaml` emits `node_kind: citations`, omitting any blank slot; a set
      slot emits `sources_slot` / `draft_slot` / `output_slot`.
- [x] `buildEditorGraph` parses a `citations` node (with or without slots) back
      to the canvas — full round-trip.
- [x] Deleting the node (with confirm) removes it and its edges.

## 5. Gating & Edge Cases

- **Single in-edge** is the *only* per-node in-degree rule in the builder; it's
  data-driven (the editor passes the set of citations node ids to the connection
  validator), not hard-coded by node kind in the rule module.
- **Reconnect:** moving the citations node's existing in-edge endpoint is allowed
  (the in-flight edge is excluded from the duplicate check).
- **Blank slots:** never serialized as empty strings — omitted entirely so the BE
  applies its canonical defaults (`sources` / `draft` / `cited_report`).
- **Deterministic:** no model/tools/emits/conditions are ever written for this
  node; the slot fields are valid only on a citations node.

## 6. UI / Theming

- Cyan icon tile + `Quote` glyph, distinct from agent (sky), decision (amber),
  connector (violet), knowledge (teal), start (emerald), end (rose). Palette tile
  and canvas card share the colour so the drop preview matches the result.
- The panel mirrors the Knowledge panel chrome (header, scroll body,
  delete-with-confirm). Responsive: fixed-width side panel consistent with the
  other node panels; inputs are fluid.

## 7. Deferred

- Tier 3 — clickable inline `[n]` footnote backlinks (presentational; also
  deferred BE-side). See pragna2_desktop_app#99.

---

_Link to Technical Spec: [technical/flowbuilder-citations-node.md](../technical/flowbuilder-citations-node.md)_
