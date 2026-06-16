//! Use cases orchestrating the client-delegated stdio MCP host (Phase F).
//!
//! Thin orchestration over the platform registry + keychain config store:
//! discovery is stateless; a call loads the connector's launch config from the
//! keychain (so secrets never reach JS) and runs against the warm registry.

use uuid::Uuid;

use crate::domain::mcp::McpHostError;
use crate::platform::mcp_registry::{self, McpRegistry};

// Re-export the boundary types so the adapter layer imports them from
// Application (not Domain directly — see adapters/mod.rs).
pub use crate::domain::mcp::{StdioLaunchConfig, ToolSchema};

/// Discover a server's tools (ephemeral spawn → list_tools → teardown).
pub async fn discover(cfg: &StdioLaunchConfig) -> Result<Vec<ToolSchema>, McpHostError> {
    McpRegistry::discover(cfg).await
}

/// Run a delegated tool call: load the connector's launch config from the
/// keychain, then call against its warm service.
pub async fn call(
    registry: &McpRegistry,
    id: Uuid,
    upstream_name: &str,
    args: serde_json::Value,
) -> Result<String, McpHostError> {
    let cfg = mcp_registry::load_config(id)?;
    registry.call(id, &cfg, upstream_name, args).await
}

/// Persist a connector's launch config (incl. env secrets) in the OS keychain.
pub fn save_config(id: Uuid, cfg: &StdioLaunchConfig) -> Result<(), McpHostError> {
    mcp_registry::save_config(id, cfg)
}

/// Remove a connector's stored launch config (on server removal).
pub fn clear_config(id: Uuid) -> Result<(), McpHostError> {
    mcp_registry::clear_config(id)
}

/// Run `<command> auth` as a plain subprocess and wait for it to exit.
///
/// The mcp-adaptor's `auth` subcommand opens a browser for an OAuth login flow
/// and stores fresh tokens in the OS keyring. This is NOT an MCP session — it is
/// a plain process invocation with no rmcp involvement. Call this when a
/// [`McpHostError::AuthExpired`] is returned by `discover` or `call`, then retry
/// the original operation.
///
/// # Errors
///
/// - [`McpHostError::Spawn`] — the binary could not be launched (not found, not
///   executable, or the OS denied the spawn).
/// - [`McpHostError::Protocol`] — the process launched but exited with a non-zero
///   status code (auth was cancelled or the gateway rejected the credentials).
pub async fn auth(command: &str) -> Result<(), McpHostError> {
    let status = tokio::process::Command::new(command)
        .arg("auth")
        .status()
        .await
        .map_err(|e| McpHostError::Spawn(e.to_string()))?;

    if status.success() {
        Ok(())
    } else {
        Err(McpHostError::Protocol(format!(
            "mcp-adaptor auth exited with {}",
            status.code().map_or("unknown status".to_string(), |c| c.to_string())
        )))
    }
}
