# Technical Spec: MCP Auth Refresh

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-16
> **Last Updated**: 2026-06-16

---

## 1. Overview

Adds a `mcp_stdio_auth` Tauri command that runs the mcp-adaptor OAuth browser flow as a plain
subprocess, a TypeScript wrapper in `mcpStdio.ts`, and per-card "Authenticate" buttons in
`LocalServersView` with success/error feedback.

**Why not sentinel-based detection:** the initial implementation attempted to map the expired-token
condition to a `McpHostError::AuthExpired` variant by matching `"failed to ensure valid token"` in
the rmcp error string. This was incorrect — rmcp returns `"connection closed: initialize response"`
at the protocol level, and the auth-specific text appears only in the child process's stderr (which
rmcp discards). The sentinel could never match, so the variant was removed. The per-card always-on
Authenticate button is the correct design.

## 2. Architecture & Layer Placement

- **Application** (`src-tauri/src/application/mcp_host.rs`): `auth(command: &str) -> Result<(), McpHostError>` — spawns `<command> auth` as a plain OS process, waits for exit.
- **Adapters** (`src-tauri/src/adapters/mcp_commands.rs`): `mcp_stdio_auth(command: String) -> Result<(), String>` Tauri command.
- **lib.rs**: `mcp_stdio_auth` registered in `invoke_handler`.
- **Frontend infrastructure** (`src/infrastructure/platform/mcpStdio.ts`): `auth(command: string)` method.
- **Frontend presentation** (`src/presentation/views/settings/LocalServersView/LocalServersView.tsx`): `commandByName` map, `authenticatingId`/`authResult` state, `handleAuthenticate`, per-card Authenticate button + status message.

## 3. Data Flow

```
User clicks "Authenticate" on a server card
    |
    v
handleAuthenticate(connector)
    → command = commandByName.get(connector.displayName)
    → setAuthenticatingId(connector.id)
    → mcpStdio.auth(command)
        → invoke('mcp_stdio_auth', { command })
            → tokio::process::Command::new(command)
                  .arg("auth")
                  .status().await
            → Ok(ExitStatus::success()) → Ok(())
            → Ok(ExitStatus::failure()) → Err("mcp-adaptor auth exited with …")
            → Err(io::Error)            → Err("failed to launch auth: …")

success
    → setAuthResult({ id, ok: true, msg: 'Authenticated successfully.' })

failure
    → setAuthResult({ id, ok: false, msg: extractErrorMessage(e) })

always
    → setAuthenticatingId(null)
```

## 4. Module & File Layout

```
src-tauri/src/
  application/
    mcp_host.rs               ← auth(command) use case
  adapters/
    mcp_commands.rs           ← mcp_stdio_auth Tauri command
  lib.rs                      ← register mcp_stdio_auth

src/
  infrastructure/
    platform/
      mcpStdio.ts             ← auth(command) method
  presentation/
    views/settings/
      LocalServersView/
        LocalServersView.tsx  ← commandByName, authenticatingId, authResult, handleAuthenticate
        LocalServersView.test.tsx

docs/specs/
  features/mcp-auth-refresh.md
  technical/mcp-auth-refresh.md
```

## 5. Method Specifications

### `mcp_host::auth` (application/mcp_host.rs)

#### `pub async fn auth(command: &str) -> Result<(), McpHostError>`

| Field | Detail |
|-------|--------|
| **Purpose** | Run `<command> auth` as a plain subprocess; wait for exit |
| **Inputs** | `command: &str` — absolute path to the mcp-adaptor binary |
| **Output** | `Ok(())` on exit code 0 |
| **Errors** | `McpHostError::Spawn` if the process cannot be started; `McpHostError::Protocol` if it exits non-zero (message includes exit code) |
| **Side Effects** | Spawns a child process that opens a browser window and stores tokens in the OS keyring |
| **Invariants** | Does NOT interact with rmcp or the MCP registry; purely an OS process invocation |

---

### `mcp_stdio_auth` (adapters/mcp_commands.rs)

#### `pub async fn mcp_stdio_auth(command: String) -> Result<(), String>`

| Field | Detail |
|-------|--------|
| **Purpose** | Tauri command adapter — thin wrapper over `mcp_host::auth` |
| **Inputs** | `command: String` — binary path from the frontend |
| **Output** | `Ok(())` on success |
| **Errors** | `Err(String)` — the `McpHostError` display string |
| **Side Effects** | Runs mcp-adaptor OAuth browser flow; stores tokens in OS keyring |

---

### `mcpStdio.auth` (infrastructure/platform/mcpStdio.ts)

#### `auth(command: string): Promise<void>`

| Field | Detail |
|-------|--------|
| **Purpose** | Frontend platform wrapper; throws `NotInTauriError` in browser |
| **Inputs** | `command: string` — binary path (from `commandByName` map) |
| **Output** | `Promise<void>` — resolves on exit-0 |
| **Errors** | `NotInTauriError` if not in Tauri; rejects with the Rust error string on failure |
| **Side Effects** | Invokes `mcp_stdio_auth` Tauri command which spawns the browser OAuth flow |

---

### `LocalServersView` (presentation) — state additions

| State | Type | Purpose |
|-------|------|---------|
| `commandByName` | `Map<string, string>` | Parsed from `editorText`; maps displayName → command |
| `authenticatingId` | `string \| null` | connector id whose auth is in-flight; `null` when idle |
| `authResult` | `{ id, ok, msg } \| null` | Result of the most recent auth attempt; keyed by connector id |

#### `commandByName` computation

```typescript
const commandByName = useMemo<Map<string, string>>(() => {
  try {
    const parsed = JSON.parse(editorText) as LocalServersConfig;
    return new Map(Object.entries(parsed.mcpServers).map(([name, cfg]) => [name, cfg.command]));
  } catch {
    return new Map();
  }
}, [editorText]);
```

#### `handleAuthenticate` callback

1. Look up `command = commandByName.get(connector.displayName)`; return early if not found.
2. `setAuthenticatingId(connector.id)`, `setAuthResult(null)`.
3. `await mcpStdio.auth(command)`.
4. On success: `setAuthResult({ id, ok: true, msg: 'Authenticated successfully.' })`.
5. On failure: `setAuthResult({ id, ok: false, msg: extractErrorMessage(e) })`.
6. Always: `setAuthenticatingId(null)`.

## 6. Error Handling Strategy

| Error | Layer | Propagation |
|-------|-------|-------------|
| `McpHostError::Spawn(msg)` (auth binary not found) | Domain | `→ Err("failed to start MCP server: {msg}")` at Tauri boundary |
| `McpHostError::Protocol(msg)` (auth exits non-zero) | Domain | `→ Err("MCP protocol error: {msg}")` |
| Tauri string rejection | Frontend | Caught by `extractErrorMessage`; shown below the card as `authResult.msg` |
| `NotInTauriError` | Frontend | Caught; shown as error below the card |

## 7. Testing Plan

| Test | Type | What It Verifies |
|------|------|-----------------|
| `shows Authenticate button for a server whose command is in editorText` | Vitest component | Button present when `commandByName` has the server name |
| `calls mcpStdio.auth with the correct command on click` | Vitest component | `mcpStdio.auth` called with the right binary path |
| `shows success status message after auth succeeds` | Vitest component | `"Authenticated successfully."` shown below card |
| `shows error status message when auth fails` | Vitest component | Error string shown below card |
| `shows "Authenticating…" text while auth is in-flight` | Vitest component | Button text changes while `authenticatingId` is set |
| `shows the protocol error message when save fails` | Vitest component | CF-014 regression: plain string error shown in Sheet |
| `disables Save when formatError is set` | Vitest component | Save button disabled while JSON is invalid |

## 8. Dependencies & External Integrations

- No new crates required — `tokio::process::Command` already available via `tokio` with `process` feature.
- No new npm packages.
- mcp-adaptor binary must support `<binary> auth` subcommand (verified: v2.0.22 and v2.1.0 both do).

## 9. Open Questions / Risks

- [x] **Sentinel approach abandoned:** rmcp error `"connection closed: initialize response"` never contains child stderr; sentinel `"failed to ensure valid token"` could never match. Per-card always-on button is correct.
- [x] **Multiple binaries:** Each card has its own Authenticate button; all supported simultaneously.
- [ ] **macOS Gatekeeper:** On macOS, a freshly downloaded binary might be quarantined. Out of scope — the `auth` call would fail with a `Spawn` error in that case.

---

_Link to Feature Spec: [features/mcp-auth-refresh.md](../features/mcp-auth-refresh.md)_
