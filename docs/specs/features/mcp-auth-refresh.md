# Feature Spec: MCP Auth Refresh

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-16
> **Last Updated**: 2026-06-16

---

## 1. Overview

When the mcp-adaptor OAuth refresh token expires, saving a local MCP server config in the
Developer settings fails with an opaque protocol error. There is currently no way to
re-authenticate from within the app — the user must find and run the binary manually in a terminal.

This feature adds a persistent **"Authenticate"** button to each configured local server card in the
Developer settings. Clicking it runs the mcp-adaptor's built-in OAuth browser flow (`<binary>
auth`). The button is always visible (not conditional on a save error), because the expired-token
condition is detectable only by trying to authenticate — the rmcp protocol error text that arrives
after a failed connection attempt is `"connection closed: initialize response"` and does not contain
the underlying auth reason.

## 2. Goals & Non-Goals

**Goals**
- [x] Show an "Authenticate" button on every configured local server card whose binary command is known
- [x] Clicking "Authenticate" opens the mcp-adaptor browser OAuth flow from within the app
- [x] Show a success or error status message below the card row after auth completes
- [x] Disable the button while authentication is in progress ("Authenticating…")

**Non-Goals**
- Auto-retry save after auth (user re-clicks Save manually after authenticating)
- Background token refresh / scheduled polling
- Multi-binary auth in a single action
- Streaming the auth subprocess output to the UI
- Handling auth for remote (HTTP/SSE) MCP connectors

## 3. User Stories

| As a...        | I want to...                                              | So that...                                          |
|----------------|-----------------------------------------------------------|-----------------------------------------------------|
| desktop user   | see an "Authenticate" button on each server card          | I can re-auth at any time without using a terminal  |
| desktop user   | re-authenticate without leaving the app                   | I don't need to find and run binaries in a terminal |
| desktop user   | see a success confirmation after auth completes           | I know it worked and I can try saving again         |

## 4. Acceptance Criteria

- [x] Given at least one configured local server, each card shows an "Authenticate" button (visible always, not only on error).
- [x] Given the user clicks "Authenticate", the mcp-adaptor OAuth browser window opens.
- [x] Given the browser OAuth flow completes successfully, the card shows "Authenticated successfully."
- [x] Given the auth subprocess exits non-zero, the card shows the error message from the subprocess.
- [x] Given authentication is in progress, the button is disabled and shows "Authenticating…".
- [x] Given a server card whose command is not resolvable from the current editor text, no "Authenticate" button is shown.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Token refresh still fails after re-auth (gateway down) | Auth command returns error; error shown below the card |
| User closes the browser OAuth window without completing | Auth command exits non-zero; error shown below card |
| Editor text is invalid JSON (commandByName empty) | Authenticate buttons not shown (commands unknown) |
| User clicks Authenticate while another server is authenticating | No interference — each card tracks its own `authenticatingId` |
| Desktop app running in browser (non-Tauri) | `NotInTauriError` caught; shown as error message below the card |

## 6. Out of Scope

- Token expiry detection outside the save flow (e.g. during a live tool call)
- UI indicator showing token freshness / expiry countdown
- Auto-retry save after successful auth
- Auth for remote HTTP/SSE connectors
- Linux support (out of scope for V1 entirely)

## 7. Open Questions

- [x] Should the button be always visible or only on save error? **Decision:** Always visible — reliable expiry detection via rmcp error text is not feasible (the auth reason is in child stderr, not the rmcp protocol error).

---

_Link to Technical Spec: [technical/mcp-auth-refresh.md](../technical/mcp-auth-refresh.md)_
