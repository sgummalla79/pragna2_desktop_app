# Feature Spec: Conversation List Item Context Menu

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-12
> **Last Updated**: 2026-06-12

---

## 1. Overview

Each conversation row in the chat sidebar gains a **3-dot context menu** (MoreVertical trigger)
that exposes **Pin / Unpin**, **Rename**, and **Delete** actions. The menu appears on hover or
while open; rename switches the row to an inline edit form; delete requires confirmation via an
`AlertDialog`. Applies to both macOS and Windows.

## 2. Goals & Non-Goals

**Goals**
- [x] MoreVertical (⋮) button appears on hover (and stays visible while the menu is open).
- [x] Menu items: Pin (or Unpin when already pinned), Rename, separator, Delete (destructive red).
- [x] Rename switches the row to an inline edit form with Save (✓) and Cancel (✗) buttons;
      submitting an empty or unchanged title is a no-op.
- [x] Delete opens an `AlertDialog` confirmation before deleting; navigates away if the
      deleted conversation is currently active.
- [x] Cost chip fades out when the 3-dot button becomes visible (no overlap).
- [x] Works identically on macOS and Windows.

**Non-Goals**
- Bulk-select or multi-delete.
- A keyboard shortcut to open the menu.
- Additional menu items (share, export, etc.).

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | pin a conversation | it stays at the top of my list |
| user | rename a conversation | I can give it a meaningful title |
| user | delete a conversation | I can clean up my history |
| user | confirm before deleting | I don't accidentally lose a conversation |

## 4. Acceptance Criteria

- [x] Given I hover a conversation row, the ⋮ button appears; clicking it opens the menu.
- [x] Given the conversation is unpinned, the menu shows "Pin"; clicking it pins it.
- [x] Given the conversation is pinned, the menu shows "Unpin"; clicking it unpins it.
- [x] Given I click Rename, the row switches to an inline input pre-filled with the current
      title; pressing Enter or blurring saves; Escape cancels.
- [x] Given I click Delete, an AlertDialog asks for confirmation; Cancel dismisses; Delete
      deletes and navigates to /chat if the conversation was active.
- [x] The ⋮ button stays visible while the dropdown or AlertDialog is open (row stays highlighted).
- [x] The cost chip is hidden while the ⋮ button is visible.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Rename to empty string | No-op; title is unchanged. |
| Rename to the same title | No-op (checked before calling the API). |
| Delete the active conversation | Navigate to `/chat` before deleting. |
| Pin/rename/delete API error | Logged via `logger.fromError`; UI resets (optimistic update rolls back on error). |
| Menu open then window scrolls | Radix portal keeps the menu correctly positioned. |

## 6. Out of Scope

- A keyboard shortcut for the context menu.
- Right-click (context menu) trigger — only the ⋮ button.
- Undo delete.
