# Technical Spec — OAuth Disconnect (Clean Reconnect)
<!-- tracker: nexus-kit-tracker #249 -->

## Endpoint

```
DELETE /api/mcp-connectors/{connector_id}/oauth-tokens
Authorization: Bearer <token>
```

**Responses**
- `204 No Content` — tokens cleared; `has_oauth_tokens` will be `false` on the next GET.
- `400` — connector `auth_type` is not `oauth`.
- `404` — connector not found or not owned by the requesting user.

## Architecture

All changes follow the existing Clean Architecture layering used by every other connector operation:

```
Domain type (unchanged)
  → IMcpConnectorRepository (port — new method)
  → McpConnectorRepository (adapter — implementation)
  → McpConnectorService (application facade — new method)
  → useDisconnectConnectorOAuth (TanStack Query hook)
  → ConnectorCard (presentation — Disconnect button)
```

## Changed Files

| File | Change |
|------|--------|
| `src/constants/errors.ts` | Added `CON_010` error entry |
| `src/application/ports/IMcpConnectorRepository.ts` | Added `disconnectOAuth(id: string): Promise<void>` |
| `src/infrastructure/repositories/McpConnectorRepository.ts` | Implemented `disconnectOAuth` |
| `src/application/services/McpConnectorService.ts` | Added `disconnectOAuth` facade method |
| `src/presentation/hooks/mcp-connectors/useMcpConnectors.ts` | Added `useDisconnectConnectorOAuth` hook |
| `src/presentation/views/settings/ConnectorsView/ConnectorCard.tsx` | Disconnect button + handler |
| `src/infrastructure/repositories/McpConnectorRepository.test.ts` | 1 new test |
| `src/presentation/views/settings/ConnectorsView/ConnectorCard.test.tsx` | 3 new tests |

## Method Signatures

### `IMcpConnectorRepository.disconnectOAuth`
```typescript
/**
 * Clear all stored OAuth tokens and any in-flight handshake state, leaving
 * the connector config intact and ready for a fresh consent flow. Maps to
 * `DELETE /api/mcp-connectors/{id}/oauth-tokens` (204).
 */
disconnectOAuth(id: string): Promise<void>;
```

### `McpConnectorRepository.disconnectOAuth`
```typescript
async disconnectOAuth(id: string): Promise<void> {
  await this.http.delete(`/mcp-connectors/${id}/oauth-tokens`);
}
```

### `McpConnectorService.disconnectOAuth`
```typescript
/**
 * Clear all stored OAuth tokens and any in-flight handshake state for the
 * connector, leaving its config intact so the user can reconnect via a fresh
 * consent flow. After this call `hasOauthTokens` will be `false` on the
 * connector.
 */
disconnectOAuth(id: string): Promise<void>
```

### `useDisconnectConnectorOAuth`
```typescript
/** Disconnect an OAuth connector by clearing its stored tokens. Invalidates
 *  connectors + tools on success. */
function useDisconnectConnectorOAuth(): UseMutationResult<void, Error, string>
```
- **mutationFn**: `(id: string) => mcpConnectorService.disconnectOAuth(id)`
- **onSuccess**: invalidates `['mcp-connectors']` and `['tools']`

## UI Changes — ConnectorCard

**New state / variables:**
- `disconnectOAuth = useDisconnectConnectorOAuth()`
- `disconnectPending = disconnectOAuth.isPending`

**New handler:**
```typescript
async function handleDisconnect() {
  setError(null);
  setOauthNote(null);
  try {
    await disconnectOAuth.mutateAsync(connector.id);
  } catch (err) {
    setError(detailOr(err, ERRORS.CON_010.message));
  }
}
```

**Disconnect button** (rendered inside the OAuth section only when `connector.hasOauthTokens`):
- Uses existing `ConfirmButton` component for the confirmation dialog.
- Disabled when `disconnectPending || connectPending`.
- After success, the connector refetches from the invalidated query with `hasOauthTokens: false`,
  which causes the card to re-render showing "Connect with OAuth" and no Disconnect button.

**Connect/Reconnect button guard** extended:
- `disabled={connectPending || disconnectPending}` (was `disabled={connectPending}`).

## Data Flow

```
User clicks "Disconnect"
  → ConfirmButton dialog shown
User clicks "Disconnect" (confirm)
  → handleDisconnect()
  → disconnectOAuth.mutateAsync(connector.id)
  → McpConnectorService.disconnectOAuth(id)
  → McpConnectorRepository.disconnectOAuth(id)
  → DELETE /api/mcp-connectors/{id}/oauth-tokens → 204
  → onSuccess: invalidate ['mcp-connectors'], ['tools']
  → React Query refetches connectors list
  → connector.hasOauthTokens === false
  → Card re-renders: badge "not connected", button "Connect with OAuth"
```

## Error Handling

| Scenario | Error code | User message |
|----------|-----------|--------------|
| Network failure | CON_010 | "Failed to disconnect. Please try again." |
| 400 (not oauth) | CON_010 | "Failed to disconnect. Please try again." |
| 404 (not found) | CON_010 | "Failed to disconnect. Please try again." |

Errors are shown inline in the expanded card body (existing error display pattern).

## Test Coverage

**McpConnectorRepository.test.ts** — 1 new case:
- `disconnectOAuth` calls `DELETE /mcp-connectors/{id}/oauth-tokens` and resolves void.

**ConnectorCard.test.tsx** — 3 new cases:
- Disconnect button shown (and calls `disconnectOAuth`) when `hasOauthTokens: true`.
- Disconnect button absent when `hasOauthTokens: false`.
- Error message shown when `disconnectOAuth` rejects.
