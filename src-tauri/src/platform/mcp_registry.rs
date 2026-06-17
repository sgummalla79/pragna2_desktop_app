//! Warm registry of running local stdio MCP services + the keychain launch-config
//! store (Phase F). Platform layer because it owns long-lived OS subprocesses +
//! the OS keychain; teardown lives here.
//!
//! v1 keeps it simple: one warm `RunningService` per connector, and a tool call
//! is made while holding the registry lock. That serialises calls (acceptable
//! for the interactive desktop — one run at a time), and avoids `Arc`/`Peer`
//! lifetime gymnastics. Dropping a service closes its stdio transport; the
//! subprocess is `kill_on_drop` so it can't leak.

use std::collections::HashMap;
use std::time::Duration;

use rmcp::model::CallToolRequestParam;
use rmcp::service::{RoleClient, RunningService};
use rmcp::transport::TokioChildProcess;
use rmcp::ServiceExt;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::domain::mcp::{
    is_auth_error_signal, service_from_error_text, DelegatedCallOutcome, McpHostError,
    StdioLaunchConfig, ToolSchema, REAUTH_REASON_TOKEN_EXPIRED,
};

/// Bound the handshake when spawning a server.
const STARTUP_TIMEOUT: Duration = Duration::from_secs(30);
/// Hard per-tool-call wall-clock bound (a hung/blocking-reauth tool → Timeout).
const CALL_TIMEOUT: Duration = Duration::from_secs(120);
/// Keychain key prefix for a connector's launch config.
const KEYRING_CONFIG_PREFIX: &str = "mcp_stdio:";

type ClientService = RunningService<RoleClient, ()>;

/// Process registry: one warm service per connector id. Held in Tauri state.
#[derive(Default)]
pub struct McpRegistry {
    services: Mutex<HashMap<Uuid, ClientService>>,
}

impl McpRegistry {
    /// Spawn an EPHEMERAL service, list its tools, tear it down (registration
    /// discovery — never added to the warm registry).
    pub async fn discover(cfg: &StdioLaunchConfig) -> Result<Vec<ToolSchema>, McpHostError> {
        let service = tokio::time::timeout(STARTUP_TIMEOUT, spawn_service(cfg))
            .await
            .map_err(|_| McpHostError::Timeout)??;
        let listed = service
            .list_tools(Default::default())
            .await
            .map_err(|e| McpHostError::Protocol(e.to_string()));
        // Always tear the ephemeral process down, even if list_tools failed.
        let _ = service.cancel().await;
        Ok(listed?.tools.into_iter().map(tool_to_schema).collect())
    }

    /// Call a tool on the connector's WARM service (spawn-or-reuse).
    ///
    /// Classifies the outcome instead of discarding `result.isError` (tracker
    /// #124): an `isError` result whose flattened content matches an auth signal,
    /// OR a raised call error whose message matches one, yields
    /// [`DelegatedCallOutcome::AuthRequired`] (with `service` left `None` here —
    /// the application layer enriches it from the launch config). Everything else
    /// is a normal [`DelegatedCallOutcome::Result`]. Service derivation is NOT done
    /// here so the registry stays focused on process lifecycle.
    pub async fn call(
        &self,
        id: Uuid,
        cfg: &StdioLaunchConfig,
        upstream_name: &str,
        args: serde_json::Value,
    ) -> Result<DelegatedCallOutcome, McpHostError> {
        let mut map = self.services.lock().await;
        if !map.contains_key(&id) {
            let service = tokio::time::timeout(STARTUP_TIMEOUT, spawn_service(cfg))
                .await
                .map_err(|_| McpHostError::Timeout)??;
            map.insert(id, service);
        }
        let service = map.get(&id).expect("inserted above");
        let arguments = args.as_object().cloned();
        let call = tokio::time::timeout(
            CALL_TIMEOUT,
            service.call_tool(CallToolRequestParam {
                name: upstream_name.to_string().into(),
                arguments,
            }),
        )
        .await
        .map_err(|_| McpHostError::Timeout)?;

        match call {
            Ok(result) => {
                let content = flatten_result(&result);
                let is_error = result.is_error.unwrap_or(false);
                // Diagnostic for the #124 verify-first step: one real expired-GUS
                // run reveals which channel carries the signal (isError body here,
                // vs raised error below, vs stderr — see the tech spec §10).
                if is_error {
                    eprintln!(
                        "[mcp_stdio_call] isError result (auth_signal={}): {}",
                        is_auth_error_signal(&content),
                        truncate_for_log(&content),
                    );
                }
                if is_error && is_auth_error_signal(&content) {
                    // Primary: extract provider name from mcp-adaptor error text
                    // (e.g. "for provider 'gus'"). Works for --profile connectors
                    // where launch args carry no --server/--provider flag (#129).
                    let service = service_from_error_text(&content);
                    Ok(DelegatedCallOutcome::AuthRequired {
                        service,
                        reason: REAUTH_REASON_TOKEN_EXPIRED.to_string(),
                    })
                } else {
                    Ok(DelegatedCallOutcome::Result { content })
                }
            }
            Err(err) => {
                // A raised protocol error that LOOKS like auth (e.g. a 401 the
                // transport surfaced as an error) is treated as auth-required too,
                // not a hard failure — defensive coverage for the unknown channel.
                let message = err.to_string();
                if is_auth_error_signal(&message) {
                    eprintln!(
                        "[mcp_stdio_call] auth-classified call error: {}",
                        truncate_for_log(&message)
                    );
                    let service = service_from_error_text(&message);
                    Ok(DelegatedCallOutcome::AuthRequired {
                        service,
                        reason: REAUTH_REASON_TOKEN_EXPIRED.to_string(),
                    })
                } else {
                    Err(McpHostError::Protocol(message))
                }
            }
        }
    }

    /// Tear down every warm service (app close). Cancel closes each transport.
    pub async fn shutdown_all(&self) {
        let mut map = self.services.lock().await;
        for (_, service) in map.drain() {
            let _ = service.cancel().await;
        }
    }
}

async fn spawn_service(cfg: &StdioLaunchConfig) -> Result<ClientService, McpHostError> {
    let mut cmd = tokio::process::Command::new(&cfg.command);
    cmd.args(&cfg.args);
    for (k, v) in &cfg.env {
        cmd.env(k, v);
    }
    cmd.kill_on_drop(true);
    let transport = TokioChildProcess::new(cmd).map_err(|e| McpHostError::Spawn(e.to_string()))?;
    ().serve(transport)
        .await
        .map_err(|e| McpHostError::Protocol(e.to_string()))
}

fn tool_to_schema(tool: rmcp::model::Tool) -> ToolSchema {
    ToolSchema {
        name: tool.name.to_string(),
        description: tool.description.map(|d| d.to_string()).unwrap_or_default(),
        input_schema: serde_json::Value::Object((*tool.input_schema).clone()),
    }
}

/// Flatten an MCP tool result to a string for the LLM. v1 serialises the content
/// array; clean text-only extraction is a refinement.
fn flatten_result(result: &rmcp::model::CallToolResult) -> String {
    serde_json::to_string(&result.content).unwrap_or_default()
}

/// Cap a string for a single-line diagnostic log so a large tool body / error
/// doesn't flood stderr. Never logs secrets — launch-config env never appears in
/// a tool result or error message.
fn truncate_for_log(text: &str) -> String {
    const MAX: usize = 300;
    if text.chars().count() <= MAX {
        text.to_string()
    } else {
        let head: String = text.chars().take(MAX).collect();
        format!("{head}…[{} bytes]", text.len())
    }
}

// ── Keychain launch-config store (secrets stay on the desktop) ───────────────

fn keyring_key(id: Uuid) -> String {
    format!("{KEYRING_CONFIG_PREFIX}{id}")
}

pub fn save_config(id: Uuid, cfg: &StdioLaunchConfig) -> Result<(), McpHostError> {
    let json = serde_json::to_string(cfg).map_err(|e| McpHostError::Serde(e.to_string()))?;
    let entry = keyring::Entry::new(crate::platform::KEYRING_SERVICE, &keyring_key(id))
        .map_err(|e| McpHostError::Keyring(e.to_string()))?;
    entry
        .set_password(&json)
        .map_err(|e| McpHostError::Keyring(e.to_string()))
}

pub fn load_config(id: Uuid) -> Result<StdioLaunchConfig, McpHostError> {
    let entry = keyring::Entry::new(crate::platform::KEYRING_SERVICE, &keyring_key(id))
        .map_err(|e| McpHostError::Keyring(e.to_string()))?;
    let json = match entry.get_password() {
        Ok(j) => j,
        Err(keyring::Error::NoEntry) => return Err(McpHostError::NotConfigured(id.to_string())),
        Err(e) => return Err(McpHostError::Keyring(e.to_string())),
    };
    serde_json::from_str(&json).map_err(|e| McpHostError::Serde(e.to_string()))
}

pub fn clear_config(id: Uuid) -> Result<(), McpHostError> {
    let entry = keyring::Entry::new(crate::platform::KEYRING_SERVICE, &keyring_key(id))
        .map_err(|e| McpHostError::Keyring(e.to_string()))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(McpHostError::Keyring(e.to_string())),
    }
}
