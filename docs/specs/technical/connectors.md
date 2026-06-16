# Technical Spec: Connectors (MCP)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

The Connectors feature is implemented in the frontend (React + TypeScript) following Clean Architecture. Domain types model MCP connectors and tools; application-layer services (`McpConnectorService`, `ToolService`) sit behind ports (`IMcpConnectorRepository`, `IToolRepository`); axios-backed repositories in the infrastructure layer call the backend `/api/mcp-connectors/*` and `/api/tools` endpoints and translate snake_case ↔ camelCase through dedicated mappers. The presentation layer exposes TanStack Query hooks (`useMcpConnectors` family + `useTools` family) consumed by the `ConnectorsView` page and its child components. The two query caches (`['mcp-connectors']` and `['tools']`) are cross-invalidated because connector mutations change the tool inventory and tool toggles change a connector's enabled count. OAuth authorization URLs are opened in the system browser via `@tauri-apps/plugin-opener`; the callback round-trip is deferred (pragna2-tracker TD-001).

## 2. Architecture & Layer Placement

- **Domain**: Type-only models — no behavior, no domain errors introduced. `src/domain/types/mcp.types.ts` (transports, auth types, credential injection shapes, connector + payload + result types) and `src/domain/types/tool.types.ts` (`Tool`, `ToolType`, `UpdateToolPayload`).
- **Application**: Ports `IMcpConnectorRepository` and `IToolRepository` (abstractions the UI depends on) and thin facade services `McpConnectorService` / `ToolService` that delegate to the injected repository. Services exist for a single injection point and consistency with the rest of the service layer.
- **Adapters (infrastructure + presentation)**: `McpConnectorRepository` / `ToolRepository` (axios via the native-HTTP adapter) implement the ports; mappers `mapMcpConnector.ts` / `mapTool.ts` translate the API boundary. Presentation: TanStack Query hooks, the `ConnectorsView` page, the `AddConnectorWizard`, `ConnectorCard`, `ConnectorDetailsForm`, `ConnectorToolToggleList`, `EditConnectorModal`, and the local `connectorPresets.ts` catalogue. OAuth uses `@tauri-apps/plugin-opener`.

## 3. Data Flow

```
Register:
ConnectorDetailsForm.onSubmit(DetailsSubmit)
  -> AddConnectorWizard.handleDetailsSubmit -> useRegisterMcpConnector.mutateAsync(CreateMcpConnectorPayload)
  -> McpConnectorService.register -> IMcpConnectorRepository.register
  -> McpConnectorRepository.register: POST /mcp-connectors (toApiCreatePayload) -> mapRegisteredMcpConnector
  -> onSuccess: invalidate ['mcp-connectors'] + ['tools'] -> wizard advances to tool step

Tool toggle:
ConnectorToolToggleList.onChange -> useToggleTool.mutateAsync({id, {enabled}})
  -> ToolService.setEnabled -> IToolRepository.setEnabled
  -> ToolRepository.setEnabled: PATCH /tools/{id} -> mapTool
  -> onSuccess: invalidate ['tools'] + ['mcp-connectors']

OAuth start:
ConnectorCard.handleConnect / Wizard.handleOAuthConnect -> useStartConnectorOAuth.mutateAsync({id, StartOAuthPayload})
  -> McpConnectorService.startOAuth -> McpConnectorRepository.startOAuth: POST /mcp-connectors/{id}/oauth-authorization
  -> if requiresManualClient: show client-id form; else openUrl(authorizationUrl) [@tauri-apps/plugin-opener]
  -> callback NOT captured in-app (pragna2-tracker TD-001); user returns and Refreshes
```

## 4. Module & File Layout

```
src/
  domain/types/
    mcp.types.ts                 ← transports, auth types, credentials, connector + payloads + results
    tool.types.ts                ← Tool, ToolType, UpdateToolPayload
  application/
    ports/
      IMcpConnectorRepository.ts  ← connector port
      IToolRepository.ts          ← tool port
    services/
      McpConnectorService.ts      ← facade over IMcpConnectorRepository
      ToolService.ts              ← facade over IToolRepository
  infrastructure/
    http/
      axiosClient.ts              ← baseURL = API_BASE_URL (…/api); native-HTTP adapter in Tauri
      tauriHttpAdapter.ts         ← axios adapter over @tauri-apps/plugin-http
    repositories/
      McpConnectorRepository.ts   ← axios impl of IMcpConnectorRepository
      ToolRepository.ts           ← axios impl of IToolRepository
      mappers/
        mapMcpConnector.ts        ← snake_case ↔ camelCase + create/update payload mappers
        mapTool.ts                ← snake_case → Tool
  presentation/
    hooks/
      mcp-connectors/useMcpConnectors.ts  ← query/mutation hooks + cache keys
      tools/useTools.ts                   ← tool query/mutation hooks
    views/settings/ConnectorsView/
      ConnectorsView.tsx           ← page (list + empty/error/loading + wizard CTA)
      ConnectorCard.tsx            ← one connector: badges, active toggle, refresh/edit/archive, OAuth connect
      AddConnectorWizard.tsx       ← gallery → details → tools/connect
      ConnectorDetailsForm.tsx     ← shared create/edit connection + auth form
      ConnectorToolToggleList.tsx  ← per-connector tool checkboxes
      EditConnectorModal.tsx       ← edit mutable fields (URL/transport read-only)
      connectorPresets.ts          ← curated preset gallery + icon URL builders
  constants/
    api.ts                         ← API_BASE_URL (env-sourced, …/api)
    errors.ts                      ← CON_001..CON_006, TOOL_001/TOOL_002
```

## 5. Method Specifications

### `McpConnectorService`

#### `list() -> Promise<McpConnector[]>`

| Field | Detail |
|---|---|
| **Purpose** | List the user's active (non-archived) connectors with per-connector tool counts. |
| **Inputs** | None. |
| **Output** | `Promise<McpConnector[]>` — domain connectors. |
| **Errors** | Propagates axios errors from `repo.list()`. |
| **Side Effects** | None (delegates to `repo.list()`). |
| **Invariants** | Pure delegation; no mutation. |

#### `register(payload: CreateMcpConnectorPayload) -> Promise<RegisteredMcpConnector>`

| Field | Detail |
|---|---|
| **Purpose** | Register a connector; the backend runs upstream discovery and persists one tool row per discovered tool (`enabled=true`). |
| **Inputs** | `payload: CreateMcpConnectorPayload` — `displayName`, optional `description`, `transport`, `config` (`{ url }`), `authType`, optional `credentials`. |
| **Output** | `Promise<RegisteredMcpConnector>` — connector + `discoveredToolApiNames[]`. |
| **Errors** | Propagates axios errors from `repo.register()`. |
| **Side Effects** | Server-side: creates the connector row and discovered tool rows. |
| **Invariants** | Delegates to `repo.register(payload)`. |

#### `update(id: string, payload: UpdateMcpConnectorPayload) -> Promise<McpConnector>`

| Field | Detail |
|---|---|
| **Purpose** | Partial update — `displayName` / `description` / `authType` / `status` / `credentials` (+ `clearCredentials`). |
| **Inputs** | `id: string`; `payload: UpdateMcpConnectorPayload` (all optional). |
| **Output** | `Promise<McpConnector>` — updated connector. |
| **Errors** | Propagates axios errors from `repo.update()`. |
| **Side Effects** | Server-side: mutates the connector row; may clear stored credentials. |
| **Invariants** | URL and transport are NOT updatable (not in the payload). |

#### `archive(id: string) -> Promise<void>`

| Field | Detail |
|---|---|
| **Purpose** | Soft-delete a connector and cascade-disable its tools. |
| **Inputs** | `id: string`. |
| **Output** | `Promise<void>`. |
| **Errors** | Propagates axios errors from `repo.archive()`. |
| **Side Effects** | Server-side: sets `status='archived'`, cascades `enabled=false` to its tools. |
| **Invariants** | Delegates to `repo.archive(id)`. |

#### `refreshTools(id: string) -> Promise<RefreshToolsResult>`

| Field | Detail |
|---|---|
| **Purpose** | Re-run upstream discovery; existing user opt-ins preserved server-side. |
| **Inputs** | `id: string`. |
| **Output** | `Promise<RefreshToolsResult>` — `{ added, unchanged, archived }`. |
| **Errors** | Propagates axios errors from `repo.refreshTools()`. |
| **Side Effects** | Server-side: reconciles the connector's tool rows. |
| **Invariants** | Delegates to `repo.refreshTools(id)`. |

#### `startOAuth(id: string, payload: StartOAuthPayload) -> Promise<StartOAuthResult>`

| Field | Detail |
|---|---|
| **Purpose** | Begin the OAuth 2.1 connect flow; returns an authorization URL or the manual-client signal. |
| **Inputs** | `id: string`; `payload: StartOAuthPayload` (optional `clientId` / `clientSecret`, used only on manual-client fallback). |
| **Output** | `Promise<StartOAuthResult>` — `{ authorizationUrl, requiresManualClient }`. |
| **Errors** | Propagates axios errors from `repo.startOAuth()`. |
| **Side Effects** | Server-side: may register a dynamic client / mint state. No client-side token storage. |
| **Invariants** | Exactly one of `authorizationUrl` (non-null) or `requiresManualClient=true` is meaningful. |

### `ToolService`

#### `list() -> Promise<Tool[]>`

| Field | Detail |
|---|---|
| **Purpose** | Flat list across global + per-user tool rows. |
| **Inputs** | None. |
| **Output** | `Promise<Tool[]>`. |
| **Errors** | Propagates axios errors from `repo.list()`. |
| **Side Effects** | None. |
| **Invariants** | Includes disabled and not-yet-enabled rows so the FE renders full state. |

#### `setEnabled(id: string, payload: UpdateToolPayload) -> Promise<Tool>`

| Field | Detail |
|---|---|
| **Purpose** | Toggle the per-user `enabled` flag. |
| **Inputs** | `id: string`; `payload: { enabled: boolean }`. |
| **Output** | `Promise<Tool>` — updated tool. |
| **Errors** | Propagates axios errors; backend returns 403 for system-managed rows, 404 for unowned/global rows. |
| **Side Effects** | Server-side: flips the user's tool enable flag. |
| **Invariants** | Only `enabled` is mutable; other tool fields are server-controlled. |

### `McpConnectorRepository` (implements `IMcpConnectorRepository`)

> Constructor: `(http: AxiosInstance)`. All paths are resource-relative; the axios `baseURL` already includes `/api` (e.g. `/mcp-connectors` → `…/api/mcp-connectors`).

#### `list() -> Promise<McpConnector[]>`

| Field | Detail |
|---|---|
| **Purpose** | `GET /mcp-connectors`, map each row to a domain connector. |
| **Inputs** | None. |
| **Output** | `Promise<McpConnector[]>`. |
| **Errors** | Axios error (4xx/5xx) rejects the promise. |
| **Side Effects** | HTTP GET. |
| **Invariants** | Maps via `mapMcpConnector`. |

#### `register(payload) -> Promise<RegisteredMcpConnector>`

| Field | Detail |
|---|---|
| **Purpose** | `POST /mcp-connectors` with `toApiCreatePayload(payload)`; map the 201 body. |
| **Inputs** | `payload: CreateMcpConnectorPayload`. |
| **Output** | `Promise<RegisteredMcpConnector>`. |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP POST; server creates connector + discovered tool rows. |
| **Invariants** | Maps via `mapRegisteredMcpConnector`; only sets `description`/`credentials` keys when defined. |

#### `update(id, payload) -> Promise<McpConnector>`

| Field | Detail |
|---|---|
| **Purpose** | `PATCH /mcp-connectors/{id}` with `toApiUpdatePayload(payload)`. |
| **Inputs** | `id: string`; `payload: UpdateMcpConnectorPayload`. |
| **Output** | `Promise<McpConnector>`. |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP PATCH. |
| **Invariants** | Sends only the keys the caller set (unset fields unchanged server-side); maps via `mapMcpConnector`. |

#### `archive(id) -> Promise<void>`

| Field | Detail |
|---|---|
| **Purpose** | `DELETE /mcp-connectors/{id}` (204 No Content). |
| **Inputs** | `id: string`. |
| **Output** | `Promise<void>`. |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP DELETE; server soft-deletes + cascades. |
| **Invariants** | No response body consumed. |

#### `refreshTools(id) -> Promise<RefreshToolsResult>`

| Field | Detail |
|---|---|
| **Purpose** | `POST /mcp-connectors/{id}/refresh-tools`; map the diff counts. |
| **Inputs** | `id: string`. |
| **Output** | `Promise<RefreshToolsResult>` — `{ added, unchanged, archived }`. |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP POST; server reconciles tool rows. |
| **Invariants** | Maps `ApiRefreshToolsResponse` field-for-field. |

#### `startOAuth(id, payload) -> Promise<StartOAuthResult>`

| Field | Detail |
|---|---|
| **Purpose** | `POST /mcp-connectors/{id}/oauth-authorization`; map `authorization_url` / `requires_manual_client`. |
| **Inputs** | `id: string`; `payload: StartOAuthPayload`. Body only includes `client_id` / `client_secret` when defined. |
| **Output** | `Promise<StartOAuthResult>` — `{ authorizationUrl: string \| null, requiresManualClient: boolean }`. |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP POST. |
| **Invariants** | `authorizationUrl` defaults to `null` when the API field is null. |

### `ToolRepository` (implements `IToolRepository`)

> Constructor: `(http: AxiosInstance)`.

#### `list() -> Promise<Tool[]>`

| Field | Detail |
|---|---|
| **Purpose** | `GET /tools`, map each row. |
| **Inputs** | None. |
| **Output** | `Promise<Tool[]>`. |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP GET. |
| **Invariants** | Maps via `mapTool`. |

#### `setEnabled(id, payload) -> Promise<Tool>`

| Field | Detail |
|---|---|
| **Purpose** | `PATCH /tools/{id}` with `{ enabled }`. |
| **Inputs** | `id: string`; `payload: { enabled: boolean }`. |
| **Output** | `Promise<Tool>`. |
| **Errors** | Axios error rejects (403 system-managed, 404 unowned/global). |
| **Side Effects** | HTTP PATCH. |
| **Invariants** | Sends only `enabled`; maps via `mapTool`. |

### Mappers — `mapMcpConnector.ts`

#### `mapMcpConnector(raw: ApiMcpConnectorResponse) -> McpConnector`

| Field | Detail |
|---|---|
| **Purpose** | Translate a snake_case connector row to the camelCase domain entity. |
| **Inputs** | `raw: ApiMcpConnectorResponse`. |
| **Output** | `McpConnector`. |
| **Errors** | None (pure). |
| **Side Effects** | None. |
| **Invariants** | `description` → `null` when absent; `config` → `{}` when absent; `hasOauthTokens` defaults `false`; `tools` mapped via `mapToolCounts` (may be `null`). |

#### `mapRegisteredMcpConnector(raw: ApiRegisteredMcpConnectorResponse) -> RegisteredMcpConnector`

| Field | Detail |
|---|---|
| **Purpose** | Map the 201 register body — base connector + `discoveredToolApiNames`. |
| **Inputs** | `raw: ApiRegisteredMcpConnectorResponse`. |
| **Output** | `RegisteredMcpConnector`. |
| **Errors** | None (pure). |
| **Side Effects** | None. |
| **Invariants** | Spreads `mapMcpConnector(raw)`; `discoveredToolApiNames` defaults `[]`. |

#### `toApiCreatePayload(payload: CreateMcpConnectorPayload) -> Record<string, unknown>`

| Field | Detail |
|---|---|
| **Purpose** | Map the domain create payload to snake_case request body. |
| **Inputs** | `payload: CreateMcpConnectorPayload`. |
| **Output** | `{ display_name, transport, config, auth_type, description?, credentials? }`. |
| **Errors** | None (pure). |
| **Side Effects** | None. |
| **Invariants** | `description` / `credentials` keys included only when `!== undefined`. |

#### `toApiUpdatePayload(payload: UpdateMcpConnectorPayload) -> Record<string, unknown>`

| Field | Detail |
|---|---|
| **Purpose** | Map the domain update payload to a sparse snake_case body. |
| **Inputs** | `payload: UpdateMcpConnectorPayload`. |
| **Output** | Object containing only the keys the caller set (`display_name`, `description`, `auth_type`, `status`, `credentials`, `clear_credentials`). |
| **Errors** | None (pure). |
| **Side Effects** | None. |
| **Invariants** | Each key emitted only when its source field `!== undefined`, so unset fields stay unchanged server-side. |

#### `mapToolCounts(raw: ApiMcpConnectorToolCounts \| null) -> McpConnectorToolCounts \| null` (module-private)

| Field | Detail |
|---|---|
| **Purpose** | Map the per-connector tool count summary, preserving `null`. |
| **Inputs** | `raw` or `null`. |
| **Output** | `{ total, enabled }` or `null`. |
| **Errors** | None. |
| **Side Effects** | None. |
| **Invariants** | Returns `null` unchanged. |

### Mapper — `mapTool.ts`

#### `mapTool(raw: ApiToolResponse) -> Tool`

| Field | Detail |
|---|---|
| **Purpose** | Translate a snake_case tool row to the camelCase domain `Tool`. |
| **Inputs** | `raw: ApiToolResponse`. |
| **Output** | `Tool`. |
| **Errors** | None (pure). |
| **Side Effects** | None. |
| **Invariants** | Field-for-field, incl. `mcp_connector_id` → `mcpConnectorId` (nullable), `system_managed`, `auto_bind_to_default_agent`, `enabled`. |

### Presentation hooks — `useMcpConnectors.ts`

> Cache keys (exported): `MCP_CONNECTORS_KEY = ['mcp-connectors']`, `TOOLS_KEY = ['tools']`. Services obtained via `useServices()` (ServiceContext).

#### `useMcpConnectors()`

| Field | Detail |
|---|---|
| **Purpose** | `useQuery` listing connectors. |
| **Inputs** | None. |
| **Output** | `UseQueryResult<McpConnector[]>`. |
| **Errors** | Query `isError` on repository failure (page shows `CON_001`). |
| **Side Effects** | None beyond caching. |
| **Invariants** | `queryKey = MCP_CONNECTORS_KEY`; `staleTime = 30_000` ms. |

#### `useRegisterMcpConnector()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation calling `register`. |
| **Inputs** | Variables: `CreateMcpConnectorPayload`. |
| **Output** | `UseMutationResult<RegisteredMcpConnector, Error, CreateMcpConnectorPayload>`. |
| **Errors** | Mutation rejects; caller surfaces `detail` else `CON_002`. |
| **Side Effects** | `onSuccess`: invalidates `['mcp-connectors']` AND `['tools']`. |
| **Invariants** | Cross-invalidation because registration changes the tool inventory. |

#### `useUpdateMcpConnector()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation calling `update`. |
| **Inputs** | Variables: `{ id: string; payload: UpdateMcpConnectorPayload }`. |
| **Output** | `UseMutationResult<McpConnector, Error, {id, payload}>`. |
| **Errors** | Rejects; caller surfaces `detail` else `CON_003`. |
| **Side Effects** | `onSuccess`: invalidates `['mcp-connectors']` AND `['tools']` (status changes which tools resolve at runtime). |
| **Invariants** | Used for both the active/inactive toggle and the edit modal. |

#### `useArchiveMcpConnector()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation calling `archive`. |
| **Inputs** | Variables: `id: string`. |
| **Output** | `UseMutationResult<void, Error, string>`. |
| **Errors** | Rejects; caller surfaces `detail` else `CON_004`. |
| **Side Effects** | `onSuccess`: invalidates `['mcp-connectors']` AND `['tools']` (cascade-disable). |
| **Invariants** | Soft delete. |

#### `useRefreshMcpConnectorTools()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation calling `refreshTools`. |
| **Inputs** | Variables: `id: string`. |
| **Output** | `UseMutationResult<RefreshToolsResult, Error, string>`. |
| **Errors** | Rejects; caller surfaces `detail` else `CON_005`. |
| **Side Effects** | `onSuccess`: invalidates `['mcp-connectors']` AND `['tools']`. |
| **Invariants** | Caller renders the added/unchanged/archived summary. |

#### `useStartConnectorOAuth()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation calling `startOAuth`. |
| **Inputs** | Variables: `{ id: string; payload: StartOAuthPayload }`. |
| **Output** | `UseMutationResult<StartOAuthResult, Error, {id, payload}>`. |
| **Errors** | Rejects; caller surfaces `detail` else `CON_006`. |
| **Side Effects** | **No cache invalidation** (tokens would land via the callback round-trip, which is not wired — pragna2-tracker TD-001). Caller opens `authorizationUrl` via `openUrl`. |
| **Invariants** | Caller branches on `requiresManualClient` vs `authorizationUrl`. |

### Presentation hooks — `useTools.ts`

#### `useTools()`

| Field | Detail |
|---|---|
| **Purpose** | `useQuery` listing the flat tool inventory. |
| **Inputs** | None. |
| **Output** | `UseQueryResult<Tool[]>`. |
| **Errors** | Query `isError` (catalog message `TOOL_001`). |
| **Side Effects** | None beyond caching. |
| **Invariants** | `queryKey = TOOLS_KEY`; `staleTime = 30_000` ms. Consumers filter by `mcpConnectorId` to scope to a connector. |

#### `useToggleTool()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation calling `setEnabled`. |
| **Inputs** | Variables: `{ id: string; payload: { enabled: boolean } }`. |
| **Output** | `UseMutationResult<Tool, Error, {id, payload}>`. |
| **Errors** | Rejects; caller surfaces `detail` else `TOOL_002`. |
| **Side Effects** | `onSuccess`: invalidates `['tools']` AND `['mcp-connectors']` (the per-connector `tools.enabled` count is derived from tool flags). |
| **Invariants** | Cross-invalidation keeps the card's enabled count in sync. |

## 6. Error Handling Strategy

Repositories let axios errors propagate (no swallowing). Hooks expose them via mutation/query rejection. UI handlers read the backend error `detail` first and fall back to the error catalog:

```ts
function detailOr(err, fallback) {
  return String(err?.response?.data?.detail ?? fallback);
}
```

| Error | Layer | Propagation |
|---|---|---|
| `CON_001` "Failed to load connectors." | Presentation (catalog) | Shown when `useMcpConnectors` `isError`. |
| `CON_002` "Failed to register the connector…" | Presentation | Fallback in `AddConnectorWizard.handleDetailsSubmit` when register rejects and no `detail`. |
| `CON_003` "Failed to update the connector." | Presentation | Fallback for `useUpdateMcpConnector` (active toggle in `ConnectorCard`, save in `EditConnectorModal`). |
| `CON_004` "Failed to remove the connector." | Presentation | Fallback for `useArchiveMcpConnector` in `ConnectorCard`. |
| `CON_005` "Failed to refresh the connector tools." | Presentation | Fallback for `useRefreshMcpConnectorTools` in `ConnectorCard`. |
| `CON_006` "Failed to start the connection…" | Presentation | Fallback for `useStartConnectorOAuth` in `ConnectorCard` and the wizard. |
| `TOOL_001` "Failed to load tools." | Presentation (catalog) | Catalog message for tool-load failures. |
| `TOOL_002` "Failed to update the tool." | Presentation | Fallback for `useToggleTool` in `ConnectorToolToggleList`. |
| Backend `detail` (4xx/5xx) | Infrastructure → Presentation | Axios `error.response.data.detail` surfaced verbatim in preference to the catalog message. |
| HTTP status (401/403/404/409/500) | Infrastructure | Axios rejects; `NET_*` catalog entries exist; tool toggle on system-managed (403) / unowned (404) rows surfaces as `detail`/`TOOL_002`. |

## 7. Configuration & Constants

| Constant | Source | Description |
|---|---|---|
| `API_BASE_URL` | `VITE_API_BASE_URL` env (default `http://localhost:8000/api`) via `src/constants/api.ts` | Axios `baseURL`; includes the `/api` prefix so repo paths are resource-relative. |
| Error messages (`CON_*`, `TOOL_*`, `NET_*`) | `src/constants/errors.ts` | Centralised catalog; never inlined in logic. |
| `CONNECTOR_PRESETS` | `src/presentation/views/settings/ConnectorsView/connectorPresets.ts` | Curated gallery as named data (long-term home is a BE endpoint — see file docstring); not inlined in component logic. |
| Favicon / Simple Icons URL templates | `faviconUrl` / `simpleIconUrl` in `connectorPresets.ts` | Brand-icon URL builders for preset tiles. |
| `staleTime = 30_000` | `useMcpConnectors` / `useTools` | Query freshness window (ms). |
| `AUTH_OPTIONS` / `TRANSPORT_LABELS` | `ConnectorDetailsForm.tsx` | Auth-method and transport display labels (component-local UI copy). |

## 8. Testing Plan

> No automated tests shipped with this feature — tracked under pragna2-tracker TD-003. Planned coverage:

| Test | Type | What It Verifies |
|---|---|---|
| `McpConnectorRepository.*` HTTP contracts | unit (mock axios) | Correct verb/path/body for list/register/update/archive/refresh/startOAuth; snake_case body shapes. |
| `ToolRepository.*` HTTP contracts | unit (mock axios) | `GET /tools`, `PATCH /tools/{id}` with `{ enabled }`. |
| `mapMcpConnector` / `mapRegisteredMcpConnector` | unit | snake_case → camelCase, null/default handling (`config`, `hasOauthTokens`, `tools`). |
| `toApiCreatePayload` / `toApiUpdatePayload` | unit | Sparse body — only set keys emitted; URL/transport never in update body. |
| `mapTool` | unit | Field-for-field mapping incl. nullable `mcpConnectorId`. |
| Hook invalidation | unit (mock query client) | Each connector mutation invalidates `['mcp-connectors']`+`['tools']`; tool toggle invalidates both; `startOAuth` invalidates neither. |
| `ConnectorDetailsForm.buildCredentials` | unit | Correct injection list per auth mode; `clearCredentials` for none/oauth. |

## 9. Dependencies & External Integrations

- **`@tauri-apps/plugin-opener`** (`openUrl`) — opens the OAuth `authorizationUrl` in the system browser (`ConnectorCard`, `AddConnectorWizard`).
- **Native-HTTP axios adapter** (`src/infrastructure/http/tauriHttpAdapter.ts` over `@tauri-apps/plugin-http`) — wired in `axiosClient.ts` when running inside the Tauri webview, so backend calls run in Rust and bypass the webview CORS policy; falls back to the default adapter under `pnpm dev`.
- **`@tanstack/react-query`** — query/mutation hooks and cache cross-invalidation.
- **`axios`** — repository transport.
- **`radix-ui` Dialog** — wizard/edit modals; **`lucide-react`** — icons.
- **Backend `/api/mcp-connectors/*` and `/api/tools`** endpoints (external service):
  - `GET /api/mcp-connectors`, `POST /api/mcp-connectors`
  - `PATCH /api/mcp-connectors/{id}`, `DELETE /api/mcp-connectors/{id}` (204)
  - `POST /api/mcp-connectors/{id}/refresh-tools`
  - `POST /api/mcp-connectors/{id}/oauth-authorization`
  - `GET /api/tools`, `PATCH /api/tools/{id}`
- **Preset brand icons** — Google favicon service + Simple Icons CDN (loaded best-effort with monogram fallback).

## 10. Open Questions / Risks

- [ ] **OAuth callback round-trip (pragna2-tracker TD-001, P1).** No in-app listener captures the OAuth redirect, so OAuth connectors cannot be fully connected without the user manually returning and clicking Refresh. `useStartConnectorOAuth` deliberately performs no cache invalidation for this reason. Proposed fix: a localhost loopback server (RFC 8252, `tauri-plugin-oauth`) reusing the login flow in `auth0/tauriLoopbackAuthFlow.ts`.
- [ ] **Desktop `redirect_uri` acceptance.** The connector `redirect_uri` is set by the backend / registered with the upstream authorization server. Must confirm the backend accepts a loopback `redirect_uri` (or a custom deep-link scheme) for desktop clients before building the loopback path (pragna2-tracker TD-001).
- [ ] **`?oauth=success|error` query handling** in `ConnectorsView` is retained for web-app parity but never fires on desktop (no browser redirect into the app). Harmless today; revisit when pragna2-tracker TD-001 lands.
- [ ] **Preset catalogue** is local data, not backend-served — changing it requires a redeploy (acceptable interim; flagged in `connectorPresets.ts`).

---

_Link to Feature Spec: [features/connectors.md](../features/connectors.md)_
