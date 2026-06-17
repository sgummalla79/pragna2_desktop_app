//! Use cases orchestrating the client-delegated stdio MCP host (Phase F).
//!
//! Thin orchestration over the platform registry + keychain config store:
//! discovery is stateless; a call loads the connector's launch config from the
//! keychain (so secrets never reach JS) and runs against the warm registry.

use uuid::Uuid;

use crate::domain::mcp::{self, McpHostError};
use crate::platform::mcp_registry::{self, McpRegistry};

// Re-export the boundary types so the adapter layer imports them from
// Application (not Domain directly — see adapters/mod.rs).
pub use crate::domain::mcp::{DelegatedCallOutcome, StdioLaunchConfig, ToolSchema};

/// Discover a server's tools (ephemeral spawn → list_tools → teardown).
pub async fn discover(cfg: &StdioLaunchConfig) -> Result<Vec<ToolSchema>, McpHostError> {
    McpRegistry::discover(cfg).await
}

/// Run a delegated tool call: load the connector's launch config from the
/// keychain, then call against its warm service. When the call classifies as
/// auth-required (tracker #124/#129), the registry already extracts the
/// downstream `service` from the mcp-adaptor error text (PRIMARY path — works
/// for `--profile` connectors whose launch args carry no flag). If the registry
/// could not derive it (non-adaptor connectors), fall back to parsing
/// `--server`/`--provider` from the launch-config args.
pub async fn call(
    registry: &McpRegistry,
    id: Uuid,
    upstream_name: &str,
    args: serde_json::Value,
) -> Result<DelegatedCallOutcome, McpHostError> {
    let cfg = mcp_registry::load_config(id)?;
    let outcome = registry.call(id, &cfg, upstream_name, args).await?;
    Ok(match outcome {
        DelegatedCallOutcome::AuthRequired { service: None, reason } => {
            // Registry couldn't extract service from error text — fall back to
            // launch-config args (single-server --server gus connectors).
            DelegatedCallOutcome::AuthRequired {
                service: mcp::service_from_args(&cfg.args),
                reason,
            }
        }
        other => other,
    })
}

/// Derive the downstream provider (e.g. `gus`) for a connector from its stored
/// launch config args. Only covers single-server connectors launched with
/// `--server gus`; for profile-based connectors the service is derived from the
/// error text at call time (tracker #129).
pub fn service_for(id: Uuid) -> Result<Option<String>, McpHostError> {
    let cfg = mcp_registry::load_config(id)?;
    Ok(mcp::service_from_args(&cfg.args))
}

/// Persist a connector's launch config (incl. env secrets) in the OS keychain.
pub fn save_config(id: Uuid, cfg: &StdioLaunchConfig) -> Result<(), McpHostError> {
    mcp_registry::save_config(id, cfg)
}

/// Remove a connector's stored launch config (on server removal).
pub fn clear_config(id: Uuid) -> Result<(), McpHostError> {
    mcp_registry::clear_config(id)
}

/// Run `<command> auth [--provider <service>]` as a plain subprocess and wait for
/// it to exit.
///
/// The mcp-adaptor's `auth` subcommand opens a browser for an OAuth login flow
/// and stores fresh tokens in the OS keyring. This is NOT an MCP session — it is
/// a plain process invocation with no rmcp involvement. When `service` is given,
/// it drives a specific downstream provider's re-auth (`auth --provider gus`,
/// tracker #124); when `None`, it runs the adaptor's own gateway-login flow
/// (`auth`, FEAT-001).
///
/// # Errors
///
/// - [`McpHostError::Spawn`] — the binary could not be launched (not found, not
///   executable, or the OS denied the spawn).
/// - [`McpHostError::Protocol`] — the process launched but exited with a non-zero
///   status code (auth was cancelled or the gateway rejected the credentials).
pub async fn auth(command: &str, service: Option<&str>) -> Result<(), McpHostError> {
    let mut cmd = tokio::process::Command::new(command);
    cmd.arg("auth");
    if let Some(service) = service {
        cmd.arg("--provider").arg(service);
    }
    let status = cmd
        .status()
        .await
        .map_err(|e| McpHostError::Spawn(e.to_string()))?;

    if status.success() {
        Ok(())
    } else {
        Err(McpHostError::Protocol(format!(
            "mcp-adaptor auth exited with {}",
            status
                .code()
                .map_or("unknown status".to_string(), |c| c.to_string())
        )))
    }
}

/// Drive an aggregator connector's per-service re-auth (tracker #124): load the
/// connector's launch config from the keychain, resolve its binary, and run
/// `<binary> auth --provider <service>` (the same binary the connector was
/// registered with). `service` `None` falls back to the adaptor's gateway-login
/// flow. Used by the desktop's re-auth card on a `boundary=downstream_service`
/// pause; the freshly-authed adaptor then satisfies the retried tool call.
///
/// # Errors
///
/// - keychain / (de)serialisation errors from loading the launch config;
/// - [`McpHostError::Spawn`] / [`McpHostError::Protocol`] from `auth`.
pub async fn reauth(id: Uuid, service: Option<&str>) -> Result<(), McpHostError> {
    let cfg = mcp_registry::load_config(id)?;
    auth(&cfg.command, service).await
}
