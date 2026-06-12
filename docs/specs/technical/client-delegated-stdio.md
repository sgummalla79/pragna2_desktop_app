# Technical Spec: Client-delegated stdio MCP servers

> **Status**: Approved
> **Author**: Suman Gummalla
> **Created**: 2026-06-11
> **Last Updated**: 2026-06-11

---

## 1. Overview

Three coordinated pieces: (F1) a **Rust MCP stdio host** (`rmcp` + `tokio`) exposed via Tauri commands that spawns/keeps-warm local stdio servers, discovers tools, and runs tool calls; (F2) a **config-based "Local MCP servers" FE** that authors `mcpServers` JSON, reconciles it into backend connectors + keychain launch configs, and lists tools; (F3) a **headless delegation handler** in `useChatSession` that runs the existing `ask_user` pause/resume machinery — on a `mcp_tool_delegation` interrupt it executes the calls locally and auto-resumes via `/resume-tool`.

## 2. Architecture & Layer Placement

- **Rust Domain** (`src-tauri/src/domain/`): `ToolSchema`, `ToolCallResult`, `StdioLaunchConfig`, `McpHostError` (typed enum).
- **Rust Application** (`src-tauri/src/application/`): host use cases — `discover`, `call`, `save_config`/`clear_config`, `shutdown_all`.
- **Rust Adapters** (`src-tauri/src/adapters/`): `#[tauri::command]` wrappers (convert `McpHostError` → `String` at the boundary, mirroring `secure_store_*`).
- **Rust Platform** (`src-tauri/src/platform/`): the warm process registry (`Mutex<HashMap<Uuid, RunningService>>`) + `#[cfg(target_os)]` teardown ladder + keyring access.
- **FE Domain** (`src/domain/types/`): extend `McpTransport` with `'stdio'`; `StdioServerConfig`, delegation envelope types.
- **FE Application** (`src/application/`): `LocalServersService` + `ILocalServersRepository` port; reuse `IMcpConnectorRepository`/`IEpisodeRepository`.
- **FE Infrastructure**: `McpConnectorRepository` gains `registerClientDelegated`/`syncTools`; new `src/infrastructure/platform/mcpStdio.ts` (the ONLY caller of the new Tauri commands); `clientCapabilitiesInterceptor` or agent-header injection.
- **FE Presentation**: `LocalServersView` settings page; delegation wiring in `useChatSession.ts`.

## 3. Data Flow

```
REGISTER  FE config editor → per server: consent → invoke('mcp_stdio_discover',{command,args,env})
          → POST /mcp-connectors/client-delegated {display_name,tools} (→ id)  [or /{id}/sync-tools]
          → invoke('mcp_stdio_save_config',{connectorId,command,args,env})  [keyring]

RUN       agent header X-Client-Capabilities: stdio_delegation
          → BE pauses (delegation interrupt) → SSE ends → resolveOpenEpisode() → awaiting_user
          → interrupt_value.mcp_tool_delegation.calls[] → per call: invoke('mcp_stdio_call',{connectorId,upstreamName,args})
          → runRaw(.../resume-tool, {results:[{tool_result|tool_error}]})  [BE maps by index]
```

## 4. Module & File Layout

```
src-tauri/src/
  domain/mcp.rs            ToolSchema, ToolCallResult, StdioLaunchConfig, McpHostError
  application/mcp_host.rs   discover/call/save_config/clear_config/shutdown_all use cases
  adapters/mcp_commands.rs  #[tauri::command] wrappers (registered in lib.rs)
  platform/mcp_registry.rs  warm RunningService registry + teardown + keyring config store
src/
  domain/types/mcp.types.ts          + 'stdio' transport, StdioServerConfig, delegation types
  infrastructure/platform/mcpStdio.ts  invoke wrappers (isTauriRuntime guard)
  infrastructure/repositories/McpConnectorRepository.ts  + registerClientDelegated, syncTools
  application/services/LocalServersService.ts
  presentation/hooks/.../useLocalServers.ts
  presentation/views/settings/LocalServersView/        config editor + server/tool list + consent
  presentation/views/chat/hooks/useChatSession.ts      delegation handler + capability header
```

## 5. Method Specifications

### `mcp_host` (Rust)

#### `discover(command, args, env) -> Vec<ToolSchema>`
| Field | Detail |
|---|---|
| Purpose | Ephemeral spawn → `initialize` + `list_tools` → teardown; return tool schemas. |
| Inputs | command: String, args: Vec<String>, env: Map<String,String> |
| Output | Vec<ToolSchema> (name, description, input_schema) |
| Errors | `McpHostError::Spawn`/`Timeout`/`Protocol` |
| Side Effects | Spawns + reaps a subprocess (NOT added to the warm registry). |
| Invariants | No process leaks; bounded by startup timeout. |

#### `call(connector_id, upstream_name, args) -> ToolCallResult`
| Field | Detail |
|---|---|
| Purpose | Reuse-or-spawn the warm process for the connector (reads launch config from keyring), `call_tool`. |
| Inputs | connector_id: Uuid, upstream_name: String, args: Json |
| Output | ToolCallResult { result \| error } |
| Errors | maps to `tool_error` (never panics the run) |
| Side Effects | Registers/keeps a warm `RunningService`. |
| Invariants | Secrets read from keyring, never returned to JS; per-call timeout. |

#### `save_config / clear_config / shutdown_all`
Persist/remove the keyring launch config keyed `mcp_stdio:{connector_id}`; tear down all warm processes (app close).

### FE `mcpStdio.ts`
`discover`, `call`, `saveConfig`, `clearConfig` — thin `invoke<T>()` wrappers behind `isTauriRuntime()` (no-op/throw in browser), mirroring `secureStore.ts`.

## 6. Error Handling Strategy

| Error | Layer | Propagation |
|-------|-------|------------|
| `McpHostError::*` | Rust app | → `String` at the `#[tauri::command]` boundary (mirrors `secure_store_*`). |
| Tool-call failure | Rust → FE | Returned as a `ToolCallResult` error → FE maps to `{tool_error}` → BE degrades. |
| Discovery failure | Rust → FE | Surfaced in the config editor; server not registered. |
| Capability 409 | BE → web FE | Handled by the existing axios error path; desktop never hits it (declares the capability). |

## 7. Configuration & Constants

| Constant | Source | Description |
|----------|--------|-------------|
| `KEYRING_SERVICE` | `platform::KEYRING_SERVICE` (existing) | OS keychain service namespace. |
| keyring key | `mcp_stdio:{connector_id}` | Per-connector launch config (incl. env secrets). |
| `X-Client-Capabilities` | `src/constants` (new const `stdio_delegation`) | Capability header value. |
| startup / per-call timeouts | `src/constants` (FE) / Rust consts | Bound discovery + tool calls. |
| `API_BASE_URL` / `PRAGNA_BASE_URL` | `src/constants/api.ts` (existing) | Backend roots. |

## 8. Testing Plan

| Test | Type | What It Verifies |
|------|------|-----------------|
| `discover_returns_tools` | Rust unit | spawn fixture server → list_tools → schemas; process reaped. |
| `call_reuses_warm_process` | Rust unit | second call doesn't re-spawn. |
| `call_timeout_returns_error` | Rust unit | hung tool → `tool_error`, process torn down. |
| `mcpStdio guards` | vitest | no-op/throw in browser (isTauriRuntime false). |
| `reconcile add/remove/change` | vitest | config diff → discover/register/sync/delete + keychain. |
| `delegation handler maps results by index` | vitest | envelope → ordered results → /resume-tool body. |
| manual e2e | manual | real stdio server → discover → delegated call → resume; web app → 409. |

## 9. Dependencies & External Integrations

New Rust crates: `rmcp` (client + child-process transport), `tokio` (rt-multi-thread, process, io-util). Reuses the existing `keyring` crate + Tauri command pattern. No new Tauri plugin (subprocess spawned directly by `rmcp`/`tokio`).

## 10. Open Questions / Risks

- [ ] `rmcp` API surface verified against docs at implementation time (version pinned in Cargo.toml).
- [ ] Warm-process teardown on app-close wired via a Tauri window/exit handler.

---

_Link to Feature Spec: [features/client-delegated-stdio.md](../features/client-delegated-stdio.md)_
