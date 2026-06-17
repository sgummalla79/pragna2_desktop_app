# Technical Spec: MCP OAuth loopback listener (pre-registered client)

> **Status**: Draft
> **Author**: Suman Gummalla
> **Created**: 2026-06-17
> **Last Updated**: 2026-06-17
>
> Tracker **#131** · BE counterpart **#130** (pre-registered OAuth client).
> Contract source of truth: pragna2-api `docs/architecture/mcp-system.md`
> § "Pre-registered client config" + `oauth-completion` route/schema.

---

## 1. Overview

The desktop already runs an RFC 8252 loopback listener for Auth0 social login
(`@fabianlars/tauri-plugin-oauth`, driven by
`infrastructure/auth0/tauriLoopbackAuthFlow.ts`). This feature **reuses the same
plugin** for the MCP pre-registered-client OAuth flow — **no new Rust / Tauri
command** is added. The only new desktop capability is a small flow that binds
the connector's fixed `callbackPort`, opens the BE-provided authorization URL in
the system browser, captures `code` + `state`, and hands them to a new BE call
`POST /api/mcp-connectors/{id}/oauth-completion`. The connector-create form gains
a generic `config.oauth` block. The loopback path activates **iff**
`config.oauth.callbackPort` is present **and** the app runs in the Tauri runtime;
otherwise the existing browser-redirect flow is unchanged.

## 2. Architecture & Layer Placement

**Frontend (`src/`) only — no `src-tauri/` changes.**

- **Domain** (`domain/types/mcp.types.ts`): a generic `McpOAuthConfig
  { clientId; loginUrl; callbackPort }` interface; `CompleteOAuthResult
  { connectorId }`; a pure reader `readMcpOAuthConfig(config) → McpOAuthConfig |
  null` that validates the optional `config.oauth` block off a connector's
  opaque `config`.
- **Application — port** (`application/ports/IMcpConnectorRepository.ts`): add
  `completeOAuth(id, { code, state }) → CompleteOAuthResult`.
- **Application — port** (`application/ports/IMcpOAuthLoopbackFlow.ts`, new): the
  desktop loopback capture abstraction (DIP — the service depends on this
  interface, not the plugin).
- **Application — service** (`application/services/McpConnectorService.ts`):
  inject `IMcpOAuthLoopbackFlow`; add `connectViaLoopback(id, callbackPort) →
  ConnectViaLoopbackResult` orchestrating start → capture → complete. `startOAuth`
  stays for the browser-redirect path.
- **Infrastructure — repo** (`infrastructure/repositories/McpConnectorRepository.ts`):
  implement `completeOAuth` (`POST .../oauth-completion`, maps `connector_id` →
  `connectorId`).
- **Infrastructure — flow** (`infrastructure/mcp/tauriMcpOAuthLoopbackFlow.ts`,
  new): `IMcpOAuthLoopbackFlow` over the plugin — `start({ ports:[callbackPort] })`,
  `onUrl` capture, `cancel(port)`; `isTauriRuntime()`-guarded; product-agnostic
  branded success page.
- **Presentation — hook** (`presentation/hooks/mcp-connectors/useMcpConnectors.ts`):
  `useConnectorOAuthLoopback()` mutation — invalidates connectors + tools on
  success (the connector flips to connected).
- **Presentation — UI**:
  - `ConnectorCard.tsx`: in `handleConnect`, if the connector has a
    `callbackPort` and `isTauriRuntime()`, run the loopback connect (success →
    "Connected"); else the unchanged browser-redirect note.
  - `AddConnectorWizard.tsx`: same branch in `handleOAuthConnect`.
  - `ConnectorDetailsForm.tsx`: an optional "Pre-registered OAuth app"
    disclosure shown only for `authType === 'oauth'`, collecting Client ID /
    Login URL / Callback port; assembled into `DetailsSubmit.oauthConfig` and
    threaded into the create payload's `config.oauth`.

The composition root (`presentation/providers/ServiceProvider.tsx`) constructs
`new McpConnectorService(new McpConnectorRepository(axiosClient), new
TauriMcpOAuthLoopbackFlow())`.

## 3. Data Flow

```
user clicks "Connect with OAuth" on a connector with config.oauth.callbackPort
  → ConnectorCard.handleConnect()
      isTauriRuntime() && callbackPort?  ──no──> existing browser-redirect note (unchanged)
                       │yes
  → useConnectorOAuthLoopback().mutateAsync({ id, callbackPort })
      → McpConnectorService.connectViaLoopback(id, callbackPort)
          1. repo.startOAuth(id, {})                  → { authorizationUrl, requiresManualClient }
                requiresManualClient → return signal (caller surfaces) [not expected]
                !authorizationUrl    → throw
          2. loopbackFlow.capture(callbackPort, authorizationUrl)
                start({ ports:[callbackPort] })       → bound port (===callbackPort or throw)
                openUrl(authorizationUrl)              → system browser
                onUrl(req with code+state)            → { code, state }
                cancel(port)                           (finally)
          3. repo.completeOAuth(id, { code, state })  → { connectorId }
      → onSuccess: invalidate ['mcp-connectors'] + ['tools']
  → card shows "Connected via OAuth." (hasOauthTokens=true after refetch)
```

Create:
```
ConnectorDetailsForm (authType=oauth) → DetailsSubmit{ ..., oauthConfig?: McpOAuthConfig }
  → AddConnectorWizard.handleDetailsSubmit
      config = { url, ...(oauthConfig ? { oauth: oauthConfig } : {}) }
  → register → POST /api/mcp-connectors { config }   (config passes through; camelCase, no mapper xform)
```

## 4. Module & File Layout

```
src/
  domain/types/mcp.types.ts                         ← McpOAuthConfig, CompleteOAuthResult,
                                                       CompleteOAuthRequest, readMcpOAuthConfig()
  application/ports/IMcpConnectorRepository.ts      ← completeOAuth()
  application/ports/IMcpOAuthLoopbackFlow.ts  (new) ← capture(port, authorizationUrl)
  application/services/McpConnectorService.ts       ← inject flow; connectViaLoopback()
  infrastructure/repositories/McpConnectorRepository.ts        ← completeOAuth()
  infrastructure/mcp/tauriMcpOAuthLoopbackFlow.ts  (new)       ← plugin-backed capture
  infrastructure/mcp/loopbackSuccessPage.ts        (new)       ← product-agnostic success HTML
  constants/mcpOAuth.ts                            (new)       ← config keys, path, timeout
  presentation/hooks/mcp-connectors/useMcpConnectors.ts        ← useConnectorOAuthLoopback()
  presentation/views/settings/ConnectorsView/ConnectorDetailsForm.tsx  ← config.oauth fields
  presentation/views/settings/ConnectorsView/AddConnectorWizard.tsx    ← thread oauthConfig; loopback connect
  presentation/views/settings/ConnectorsView/ConnectorCard.tsx         ← loopback connect branch
  presentation/providers/ServiceProvider.tsx                   ← inject TauriMcpOAuthLoopbackFlow
```

## 5. Method Specifications

### `domain/types/mcp.types.ts`

- `interface McpOAuthConfig { clientId: string; loginUrl: string; callbackPort: number }`
  — generic pre-registered OAuth block stored under `config.oauth` (camelCase on
  the wire; `config` is opaque JSON passed through untouched).
- `interface CompleteOAuthRequest { code: string; state: string }`.
- `interface CompleteOAuthResult { connectorId: string }`.
- `function readMcpOAuthConfig(config: Record<string, unknown>): McpOAuthConfig | null`
  — returns the block only when `oauth` is an object with a non-empty string
  `clientId`, a non-empty string `loginUrl`, and an integer `callbackPort` in
  `(0, 65536)`; otherwise `null`. Pure; no I/O.

### `application/ports/IMcpOAuthLoopbackFlow.ts` (new)

```ts
interface LoopbackCaptureResult { code: string; state: string }
interface IMcpOAuthLoopbackFlow {
  /** Bind `callbackPort`, open `authorizationUrl` in the system browser, and
   *  resolve with the captured code+state from localhost:{port}/callback.
   *  Rejects on port-in-use, provider error, timeout, or non-Tauri runtime. */
  capture(callbackPort: number, authorizationUrl: string): Promise<LoopbackCaptureResult>;
}
```

### `application/services/McpConnectorService.ts`

#### `connectViaLoopback(id, callbackPort): Promise<ConnectViaLoopbackResult>`

| Field | Detail |
|---|---|
| **Purpose** | Orchestrate the desktop pre-registered OAuth connect: authorize → loopback capture → complete. |
| **Inputs** | `id: string`, `callbackPort: number`. |
| **Output** | `{ status: 'connected'; connectorId }` on success, or `{ status: 'requires_manual_client' }` if the BE asks for a manual client (caller routes to the existing manual form). |
| **Errors** | Propagates repo errors (`startOAuth` / `completeOAuth`) and loopback-flow errors (port-in-use, timeout, provider error, not-in-Tauri). The caller maps them to inline UI errors. |
| **Invariants** | `startOAuth` payload is empty — the pre-registered `clientId` already lives in `config.oauth` and is applied by the BE. |

### `infrastructure/repositories/McpConnectorRepository.ts`

#### `completeOAuth(id, { code, state }): Promise<CompleteOAuthResult>`

`POST /mcp-connectors/{id}/oauth-completion` with body `{ code, state }`;
response `{ connector_id }` → `{ connectorId }`.

### `infrastructure/mcp/tauriMcpOAuthLoopbackFlow.ts` (new)

`capture(callbackPort, authorizationUrl)`:
1. `isTauriRuntime()` guard → throw `PragnaError(CON_007)` in a plain browser.
2. `const port = await start({ ports: [callbackPort], response: SUCCESS_HTML })`
   — on bind failure (port in use) → throw `PragnaError(CON_008)`. Assert
   `port === callbackPort` (single-element pool) else throw `CON_008`.
3. `new Promise`: timeout (`MCP_OAUTH_LOOPBACK_TIMEOUT_MS`) → reject `CON_009`;
   `onUrl` → parse; `error` param → reject `CON_007`; `code`+`state` present →
   resolve; else ignore (stray request). `openUrl(authorizationUrl)`.
4. `finally`: clear timer, `unlisten()`, `cancel(port)`.

## 6. Error Handling Strategy

| Error | Layer | Propagation |
|---|---|---|
| Port in use / bind fail | infra flow | `PragnaError(CON_008)` → inline card/wizard error |
| Provider `error=` on redirect | infra flow | `PragnaError(CON_007)` → inline error |
| Timeout (user abandons) | infra flow | `PragnaError(CON_009)` → inline error |
| Not in Tauri runtime | infra flow | `PragnaError(CON_007)`; UI also pre-gates so this is defensive |
| `startOAuth` / `completeOAuth` HTTP error | repo | axios error → `detailOr(err, CON_006)` at the call site (existing pattern) |

New error catalogue entries: `CON_007` (loopback connect failed), `CON_008`
(loopback port unavailable), `CON_009` (loopback timed out).

## 7. Configuration & Constants (`constants/mcpOAuth.ts`)

| Constant | Value | Description |
|---|---|---|
| `MCP_OAUTH_CONFIG_KEY` | `'oauth'` | Key of the pre-registered block in `connector.config`. |
| `MCP_OAUTH_CLIENT_ID_KEY` / `_LOGIN_URL_KEY` / `_CALLBACK_PORT_KEY` | `'clientId'` / `'loginUrl'` / `'callbackPort'` | Inner keys (camelCase; BE contract). |
| `MCP_OAUTH_LOOPBACK_PATH` | `'/callback'` | Loopback redirect path (documentation; the listener matches on `code`+`state`, not path). |
| `MCP_OAUTH_LOOPBACK_TIMEOUT_MS` | `180_000` | Mirrors the Auth0 loopback timeout. |

No server names, ports, or client ids are hardcoded — `callbackPort`/`clientId`/
`loginUrl` always come from the connector's stored `config.oauth`.

## 8. Testing Plan

| Test | Type | What It Verifies |
|---|---|---|
| `readMcpOAuthConfig` valid / partial / wrong-type / out-of-range port | TS unit | only a fully-valid block parses; partial → `null` |
| `McpConnectorRepository.completeOAuth` | TS unit | POSTs `{code,state}` to the right URL; maps `connector_id` |
| `McpConnectorService.connectViaLoopback` happy / manual-client / capture-error | TS unit | orchestration order; empty `startOAuth` payload; error propagation (flow mocked) |
| `useConnectorOAuthLoopback` invalidates caches on success | TS unit | `['mcp-connectors']` + `['tools']` invalidated |
| `ConnectorDetailsForm` config.oauth section (oauth only; assembles block) | TS/RTL | fields visible only for oauth; full block → `oauthConfig`; partial → omitted |
| `ConnectorCard.handleConnect` loopback vs browser branch | TS/RTL | callbackPort+Tauri → `connectViaLoopback`; otherwise browser-redirect note (predicate mocked both ways per Platform Abstraction) |
| Port-in-use / timeout surface a clear error | TS/RTL | inline `CON_008` / `CON_009` message |
| Manual / Docker-BE end-to-end | E2E (manual) | real pre-registered connector → browser approval → connected (loopback capture not Playwright-automatable) |

## 9. Dependencies & External Integrations

- `@fabianlars/tauri-plugin-oauth` (already a dependency; the Auth0 flow uses it)
  — `start`/`cancel`/`onUrl`/`onInvalidUrl`. No new crates / plugins / commands.
- Docker `pragna2-api` (`Releases/V1`) with #130 — `oauth-authorization` building
  the loopback `redirect_uri` and `oauth-completion` for the exchange.
- `@tauri-apps/plugin-opener` `openUrl` (already used).

## 10. Open Questions / Risks

- [ ] **Cross-platform.** The plugin binds `localhost:{port}` identically on
      macOS and Windows; verify the bind + capture on both before merge.
- [ ] **Concurrent loopback use.** Auth0 login and a connector connect both use
      the single plugin instance but never run concurrently (login screen vs
      settings). `cancel(port)` is per-port; `onUrl` is global — capture filters
      on `code`+`state`. Acceptable; documented.
- [ ] **Web-FE parity is intentionally absent** — a browser cannot bind a
      loopback port. Filed for the web-FE owner via the tracker; not changed here.
- [ ] **End-to-end against Docker BE** with a real pre-registered connector — the
      user confirmed code+state arrive at `localhost:8082/callback`; full
      completion to be exercised before merge.

---

_Link to Feature Spec: [features/mcp-oauth-loopback-listener.md](../features/mcp-oauth-loopback-listener.md)_
