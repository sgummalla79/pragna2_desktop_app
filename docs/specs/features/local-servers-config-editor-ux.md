# Feature Spec: Developer Config Editor UX (Config button, Tree default, Example in flyout)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-21
> **Last Updated**: 2026-06-21
> **Tracker**: pragna2-tracker #178 (`type:feature`, `target:desktop-fe`)

---

## 1. Overview

Refines the Developer page (Local MCP servers) config-editor UX in `LocalServersView`.
The action that opens the JSON config editor is renamed from **"Edit Config"** to
**"Config"**, the editor flyout now opens on the **Tree** view by default (instead of
the raw JSON "Edit" tab), and the **Example config** authoring guidance is moved from a
standalone card on the main page into the top of the editor flyout. The goal is a
cleaner main page and a config editor that leads with a readable, structured view while
keeping the example reference one click away inside the editing context.

## 2. Goals & Non-Goals

**Goals**
- [x] Rename the editor-opening button to "Config" (and the empty-state hint to match).
- [x] Open the config flyout on the Tree view by default, every time it is opened.
- [x] Relocate the Example config collapsible into the flyout, at the top.

**Non-Goals**
- No change to config validation, saving, tool discovery, keychain storage, or auth flows.
- No change to the Tree/Edit rendering components themselves (`JsonTree`, textarea).

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| desktop user | open the local-servers config and see a readable tree first | I can review my servers without parsing raw JSON |
| desktop user | see the example config inside the editor | I can copy the shape while authoring, not on a separate page |
| desktop user | a concise "Config" button | the action label is short and unambiguous |

## 4. Acceptance Criteria

- [x] Given the Developer page, the editor-opening button reads **"Config"**.
- [x] Given I click **Config**, when the flyout opens, then the **Tree** view is shown by default.
- [x] Given I switch to Edit and reopen the flyout later, then it opens on Tree again.
- [x] Given the flyout is open, the **Example config** accordion appears at the top, collapsed by default, and expands on click.
- [x] Given the main Developer page, the standalone Example config card is no longer present.
- [x] Given no servers are configured, the empty-state hint reads "Use Config to add one."

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Config text is invalid JSON when Tree is the default view | Tree pane shows "Invalid JSON — switch to Edit to fix it." |
| User edits raw JSON then reopens flyout | Flyout resets to Tree; switching to Tree auto-formats first so the parse succeeds |
| Example config expanded then flyout closed/reopened | Accordion state persists within the session (controlled state not reset on open) |

## 6. Out of Scope

- Web FE (`pragna2_sgummalla_works`) parity — tracked separately per No Cross-Repo Changes.
- Any change to which view (Tree vs Edit) is used for the actual Save validation path.

## 7. Open Questions

- None.

---

_Link to Technical Spec: [technical/local-servers-config-editor-ux.md](../technical/local-servers-config-editor-ux.md)_
