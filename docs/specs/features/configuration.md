# Feature Spec: Configuration (Settings)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

The Configuration settings page holds the per-user keys and per-browser settings the workspace uses. It is built as a set of self-contained section cards so new concerns slot in without rewriting the page. Today it surfaces two sections: the per-user **embedding (Voyage) key** used for Knowledge/semantic search (a write-only key stored server-side), and **chat-action** visibility toggles persisted in the browser. The embedding key is an optional override over the deployment embedding key; the chat-action toggles let users hide advanced affordances on the chat message hover row on a per-device basis.

## 2. Goals & Non-Goals

**Goals**
- [x] Let a user set, replace, and clear their personal embedding (Voyage) key from a single card.
- [x] Show whether an embedding key is configured without ever revealing the key value.
- [x] Surface load/save/clear failures with clear, code-correlated messages.
- [x] Let a user toggle visibility of advanced chat actions ("Regenerate with a different model" and "Branch from a user message") on this device.
- [x] Keep the page responsive and the layout extensible (one card per concern).

**Non-Goals**
- Displaying or exporting the stored embedding key value (it is write-only).
- Validating the embedding key on the client — validation is a live server-side probe.
- Syncing chat-action toggles across devices/browsers (they are local-only).
- Managing any other provider keys, object-storage, or deployment-wide settings (future sections).

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user    | set my own Voyage embedding key | semantic search over my Knowledge libraries uses my key |
| user    | see whether a key is already configured | I know whether I still rely on the deployment key |
| user    | replace my embedding key | I can rotate it without exposing the old value |
| user    | remove my embedding key | embeddings fall back to the deployment key |
| user    | hide the "Regenerate with a different model" chat action | my chat hover row stays uncluttered on this device |
| user    | hide the "Branch from a user message" chat action | I only see the affordances I use |

## 4. Acceptance Criteria

- [x] Given the page loads, when the embedding-key status is fetched, then the card shows "Configured" (key set), "Not configured" (no key), "Loading…" (in flight), or "Status unavailable" (fetch error).
- [x] Given no key is set, when the user enters a key and saves, then the key is validated server-side, saved, the input is cleared, and the badge changes to "Configured".
- [x] Given a key is set, when the user submits a new value, then the existing key is replaced and the badge stays "Configured".
- [x] Given a key is set, when the user clicks Remove and confirms, then the key is cleared and the badge changes to "Not configured".
- [x] Given the API returns an error on save/clear, then the backend `detail` message is shown if present, otherwise the catalog message (CFG_002 for save, CFG_003 for clear).
- [x] Given the status query errors, then the catalog message CFG_001 is shown in the card body and a "Status unavailable" badge is shown.
- [x] Given the save input is empty (after trimming) or a save is in flight, then the Save/Replace button is disabled.
- [x] Given a chat-action toggle is changed, then the new value persists to `localStorage` and all mounted hooks update immediately (same tab and across tabs).
- [x] Given no preferences have ever been saved, then both chat-action toggles default to ON.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Embedding-key status fails to load | Body shows CFG_001 message; header badge shows "Status unavailable". |
| Save fails (invalid/rejected key) | Inline alert shows backend `detail` if present, else CFG_002 message; input is not cleared. |
| Clear fails | Inline alert shows backend `detail` if present, else CFG_003 message. |
| Empty / whitespace-only key submitted | Save button disabled (input trimmed); no request sent. |
| Save submitted with surrounding whitespace | Key is trimmed before the request. |
| Status query is loading | "Loading…" shown in place of the badge. |
| `localStorage` unavailable or holds malformed JSON | Chat preferences fall back to defaults (both ON). |
| Chat pref changed in another tab/window | The `storage` event re-syncs the snapshot in this tab. |

## 6. Out of Scope

- Revealing, copying, or exporting the embedding key value.
- Client-side embedding-key validation.
- Cross-device persistence of chat-action toggles.
- Additional configuration sections (object storage / S3, other provider keys).

## 7. Open Questions

- [ ] The placeholder `pa-…` and copy "Validated with a live test call before it's saved" describe server behavior the frontend does not implement or verify; the exact server-side validation/probe semantics are owned by the backend and not confirmed in this repo.

---

_Link to Technical Spec: [technical/configuration.md](../technical/configuration.md)_
