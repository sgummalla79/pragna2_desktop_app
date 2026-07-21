# Feature Spec — OAuth Disconnect (Clean Reconnect)
<!-- tracker: nexus-kit-tracker #249 -->

## Overview

Users can disconnect a connected OAuth MCP connector without deleting it. This clears the stored
tokens and any stale handshake state, returning the connector to the "not connected" state so the
user can immediately go through the consent flow again.

## User Stories

- As a user, I want to revoke my OAuth session for a connector so I can sign in with a different
  account or clear stale tokens, without losing the connector's configuration.
- As a user, I want a confirmation step before disconnect so I don't accidentally lose my session.
- As a user, after disconnecting I want the UI to immediately reflect the "not connected" state
  and show the "Connect with OAuth" button again.

## Acceptance Criteria

1. **Disconnect button visibility**
   - A "Disconnect" button appears in the expanded OAuth section of a connector card **only** when
     `authType === 'oauth'` and `hasOauthTokens === true`.
   - When `hasOauthTokens === false`, the Disconnect button is absent.

2. **Confirmation gate**
   - Clicking Disconnect opens a confirmation dialog naming the connector and explaining that tokens
     will be cleared but the connector and its configuration are kept.
   - Only after the user clicks the "Disconnect" confirm button is the API call made.

3. **API call**
   - On confirmation, the FE calls `DELETE /api/mcp-connectors/{id}/oauth-tokens`.
   - On 204 success: the connector and tools queries are invalidated so the card refetches with
     `hasOauthTokens: false`.
   - On error: an inline error message `CON_010` is shown inside the expanded card body.

4. **Post-disconnect UI state**
   - After a successful disconnect the card shows:
     - "not connected" badge in the header
     - Status text "Not connected. Authorize this connector to use its tools."
     - "Connect with OAuth" button (no Disconnect button)
   - No page reload is needed.

5. **Mutual exclusion**
   - While a disconnect is in progress, the Connect/Reconnect button is disabled.
   - While a connect is in progress, the Disconnect button is disabled.

6. **No connector deletion**
   - The connector's identity, config, tools, and status are untouched by disconnect.
   - The user can reconnect immediately after disconnect via the normal connect flow.

## Edge Cases

- Disconnect on a connector that is currently `inactive`: allowed (tokens are still cleared).
- Rapid double-click: the second click hits a disabled button (isPending guard).
- Network error: error message shown inline; connector state unchanged.
- 400 (connector is not oauth) / 404 (not found): surfaced via CON_010 fallback message.

## Out of Scope

- OAuth token revocation at the authorization server (this clears the BE's stored copy only).
- Bulk disconnect across multiple connectors.
