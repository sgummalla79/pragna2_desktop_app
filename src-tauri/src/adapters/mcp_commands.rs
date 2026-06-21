//! Tauri command adapters for the client-delegated stdio MCP host (Phase F).
//!
//! Convert [`McpHostError`](crate::domain::mcp::McpHostError) → `String` at the
//! boundary (mirrors the `secure_store_*` commands in `lib.rs`). The frontend
//! `src/infrastructure/platform/mcpStdio.ts` is the only caller. Secrets stay on
//! the desktop: `mcp_stdio_call` takes a `connector_id` and the host reads the
//! launch config (incl. env) from the keychain itself.

use std::collections::HashMap;

use tauri::State;
use uuid::Uuid;

use crate::application::mcp_host::{self, DelegatedCallOutcome, StdioLaunchConfig, ToolSchema};
use crate::platform::mcp_registry::McpRegistry;

fn parse_id(connector_id: &str) -> Result<Uuid, String> {
    Uuid::parse_str(connector_id).map_err(|e| format!("invalid connector id: {e}"))
}

/// Discover a local stdio server's tools (registration). Ephemeral spawn.
#[tauri::command]
pub async fn mcp_stdio_discover(
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
) -> Result<Vec<ToolSchema>, String> {
    let cfg = StdioLaunchConfig { command, args, env };
    mcp_host::discover(&cfg).await.map_err(|e| e.to_string())
}

/// Run a delegated tool call against the connector's warm local server. Returns a
/// tagged [`DelegatedCallOutcome`] — a normal `result`, or `auth_required` (with
/// the downstream `service`) when the aggregator's service token is dead (#124).
#[tauri::command]
pub async fn mcp_stdio_call(
    registry: State<'_, McpRegistry>,
    connector_id: String,
    upstream_name: String,
    args: serde_json::Value,
) -> Result<DelegatedCallOutcome, String> {
    let id = parse_id(&connector_id)?;
    mcp_host::call(registry.inner(), id, &upstream_name, args)
        .await
        .map_err(|e| e.to_string())
}

/// Persist a connector's launch config (incl. env secrets) in the OS keychain.
#[tauri::command]
pub fn mcp_stdio_save_config(
    connector_id: String,
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
) -> Result<(), String> {
    let id = parse_id(&connector_id)?;
    mcp_host::save_config(id, &StdioLaunchConfig { command, args, env }).map_err(|e| e.to_string())
}

/// Remove a connector's stored launch config (server removed from config).
#[tauri::command]
pub fn mcp_stdio_clear_config(connector_id: String) -> Result<(), String> {
    let id = parse_id(&connector_id)?;
    mcp_host::clear_config(id).map_err(|e| e.to_string())
}

/// Run `<command> auth` (the adaptor's gateway-login flow, FEAT-001) and wait for
/// the browser OAuth flow to complete. Call this when a save fails with an auth
/// error, then retry the save.
#[tauri::command]
pub async fn mcp_stdio_auth(command: String) -> Result<(), String> {
    mcp_host::auth(&command, None)
        .await
        .map_err(|e| e.to_string())
}

/// Drive an aggregator connector's per-DOWNSTREAM-service re-auth (#124): resolve
/// the connector's registered binary from the keychain and run
/// `<binary> auth --provider <service>`. Used by the re-auth card on a
/// `boundary=downstream_service` pause. `service` `None` falls back to the
/// gateway-login flow.
#[tauri::command]
pub async fn mcp_stdio_reauth(connector_id: String, service: Option<String>) -> Result<(), String> {
    let id = parse_id(&connector_id)?;
    mcp_host::reauth(id, service.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::parse_id;

    /// A well-formed UUID parses to the same id the frontend sent.
    #[test]
    fn parse_id_accepts_a_valid_uuid() {
        let raw = "550e8400-e29b-41d4-a716-446655440000";
        let id = parse_id(raw).expect("a valid uuid should parse");
        assert_eq!(id.to_string(), raw);
    }

    /// A malformed connector id surfaces as a `String` error (the shape the FE
    /// boundary expects) — never a panic. This is the only branch the
    /// `State`/keychain-bound commands own that is unit-testable in isolation.
    #[test]
    fn parse_id_rejects_garbage_as_a_string_error() {
        let err = parse_id("not-a-uuid").expect_err("garbage must not parse");
        assert!(
            err.starts_with("invalid connector id"),
            "unexpected error message: {err}"
        );
    }

    /// An empty id is rejected the same way (guards the FE passing a blank).
    #[test]
    fn parse_id_rejects_an_empty_string() {
        let err = parse_id("").expect_err("empty must not parse");
        assert!(err.starts_with("invalid connector id"), "got: {err}");
    }
}
