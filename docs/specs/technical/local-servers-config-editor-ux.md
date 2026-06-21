# Technical Spec: Developer Config Editor UX (Config button, Tree default, Example in flyout)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-21
> **Last Updated**: 2026-06-21
> **Tracker**: pragna2-tracker #178 (`type:feature`, `target:desktop-fe`)

---

## 1. Overview

A presentation-layer-only change to `LocalServersView`. Three independent UI tweaks:
a button label rename, a change to the editor's default tab state, and relocation of an
existing collapsible JSX block from the page body into the editor `Sheet` flyout. No
domain/application logic, ports, or data flow are touched.

## 2. Architecture & Layer Placement

- **Domain**: unchanged.
- **Application**: unchanged.
- **Adapters / Presentation**: `LocalServersView` (a React view) only — label text,
  the initial value of the `editorTab` state, a tab-reset on the open handler, and the
  position of the Example config accordion JSX. The unused `Card` import is removed.

## 3. Data Flow

```
[Config button onClick] -> setError(null); setEditorTab('tree'); setPanelOpen(true)
[Sheet open] -> renders Example config (top) + Edit/Tree toggle + tab body
[Tree body]  -> JSON.parse(editorText) -> <JsonTree value={parsed} />
```

No new invoke()/IPC, network, or storage calls are introduced.

## 4. Module & File Layout

```
src/presentation/views/settings/LocalServersView/
  LocalServersView.tsx        # button label, default tab, flyout layout
  LocalServersView.test.tsx   # test helper updated for the new label + Tree default
docs/specs/
  features/local-servers-config-editor-ux.md
  technical/local-servers-config-editor-ux.md
```

## 5. Method Specifications

No exported functions are added or changed. The modified internals:

### `LocalServersView` (default export, React component)

#### `editorTab` state

| Field | Detail |
|-------|--------|
| **Purpose** | Selects which editor pane renders in the flyout (`'edit'` raw JSON vs `'tree'` structured) |
| **Change** | Initial value changed from `'edit'` to `'tree'` |
| **Invariants** | Reset to `'tree'` in the Config button `onClick` so the flyout always opens on Tree |

#### Config button `onClick`

| Field | Detail |
|-------|--------|
| **Purpose** | Opens the editor flyout |
| **Inputs** | none |
| **Side Effects** | `setError(null)`, `setEditorTab('tree')`, `setPanelOpen(true)` |
| **Change** | Label text "Edit Config" → "Config"; added `setEditorTab('tree')` |

#### Example config accordion (JSX)

| Field | Detail |
|-------|--------|
| **Purpose** | Authoring guidance showing a sample `mcpServers` JSON blob |
| **Change** | Moved from a standalone `<Card>` in the page body to a bordered `<div>` at the top of `SheetContent` (above the Edit/Tree toggle) |
| **State** | Still driven by the existing `exampleOpen` boolean; default collapsed |

## 6. Error Handling Strategy

No new error types. Existing behavior preserved: invalid JSON in the Tree pane renders
the inline "Invalid JSON — switch to Edit to fix it." message; format/save errors keep
their existing `formatError` / `error` rendering.

| Error | Layer | Propagation |
|-------|-------|------------|
| Invalid JSON in Tree view | Presentation | Caught locally; inline message, no throw |

## 7. Configuration & Constants

No hard-coded values introduced. `EMPTY_CONFIG` and `EXAMPLE_CONFIG` remain
module-level constants (unchanged); the Example config now renders inside the flyout.

| Constant | Source | Description |
|----------|--------|-------------|
| `EXAMPLE_CONFIG` | module constant | Pretty-printed sample shown in the flyout's Example accordion |

## 8. Testing Plan

| Test | Type | What It Verifies |
|------|------|-----------------|
| `LocalServersView.test.tsx` suite | unit (Vitest) | Helper opens the flyout via the **"Config"** button, switches to the **Edit** tab (Tree is now default), then exercises the existing save/auth assertions; all pass |
| `tsc` | typecheck | No type regressions; removed unused `Card` import |

## 9. Responsive Design

The relocated Example accordion uses fluid widths (`w-full`, `overflow-x-auto` on the
`<pre>`) inside the existing `sm:max-w-xl` Sheet, so it adapts from narrow to wide
viewports without overflow — consistent with the rest of the flyout.
