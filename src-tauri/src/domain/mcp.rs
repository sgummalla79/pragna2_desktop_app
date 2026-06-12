//! Domain types for the client-delegated stdio MCP host (Phase F).
//!
//! A local stdio MCP server is launched from a [`StdioLaunchConfig`]; discovery
//! yields [`ToolSchema`]s; a tool call yields a flattened string result. All
//! host failures are a single typed [`McpHostError`] that the adapter layer
//! converts to `String` at the Tauri boundary (mirrors the `secure_store_*`
//! commands).

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// A tool discovered from a local MCP server's `list_tools`, in the shape the
/// backend's `/client-delegated` route expects (`name` + `description` +
/// `input_schema`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSchema {
    /// The upstream tool name (the stdio server's own name).
    pub name: String,
    /// LLM-facing description (empty string when the server omits one).
    pub description: String,
    /// The tool's JSON-Schema `inputSchema` (object).
    pub input_schema: serde_json::Value,
}

/// How to launch a local stdio MCP server. Persisted (incl. `env` secrets) only
/// in the OS keychain — never sent to the backend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StdioLaunchConfig {
    /// The executable to run (e.g. `npx`, `uvx`, an absolute path).
    pub command: String,
    /// Command-line arguments (e.g. `["-y", "@scope/server", "--profile", "x"]`).
    #[serde(default)]
    pub args: Vec<String>,
    /// Environment variables for the subprocess (carries credentials; secret).
    #[serde(default)]
    pub env: HashMap<String, String>,
}

/// Every way the host can fail. Converted to `String` at the command boundary.
#[derive(Debug)]
pub enum McpHostError {
    /// The subprocess could not be spawned (bad command, missing binary).
    Spawn(String),
    /// The MCP protocol handshake / request failed.
    Protocol(String),
    /// A request exceeded its timeout.
    Timeout,
    /// No launch config is stored for the connector (call before save).
    NotConfigured(String),
    /// The OS keychain read/write failed.
    Keyring(String),
    /// The stored launch config could not be (de)serialised.
    Serde(String),
}

impl std::fmt::Display for McpHostError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            McpHostError::Spawn(m) => write!(f, "failed to start MCP server: {m}"),
            McpHostError::Protocol(m) => write!(f, "MCP protocol error: {m}"),
            McpHostError::Timeout => write!(f, "MCP request timed out"),
            McpHostError::NotConfigured(id) => {
                write!(f, "no local MCP server configured for connector {id}")
            }
            McpHostError::Keyring(m) => write!(f, "keychain error: {m}"),
            McpHostError::Serde(m) => write!(f, "config (de)serialisation error: {m}"),
        }
    }
}

impl std::error::Error for McpHostError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_display_is_human_readable() {
        assert!(McpHostError::Timeout.to_string().contains("timed out"));
        assert!(McpHostError::Spawn("boom".into())
            .to_string()
            .contains("boom"));
        assert!(McpHostError::NotConfigured("abc".into())
            .to_string()
            .contains("abc"));
    }

    #[test]
    fn launch_config_round_trips_with_env_secrets() {
        let mut env = HashMap::new();
        env.insert("GITHUB_TOKEN".to_string(), "ghp_secret".to_string());
        let cfg = StdioLaunchConfig {
            command: "npx".into(),
            args: vec!["-y".into(), "@scope/server".into(), "--profile".into(), "x".into()],
            env,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let back: StdioLaunchConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back.command, "npx");
        assert_eq!(back.args.len(), 4);
        assert_eq!(back.env.get("GITHUB_TOKEN").unwrap(), "ghp_secret");
    }

    #[test]
    fn launch_config_defaults_args_and_env_when_absent() {
        let cfg: StdioLaunchConfig =
            serde_json::from_str(r#"{"command":"my-server"}"#).unwrap();
        assert_eq!(cfg.command, "my-server");
        assert!(cfg.args.is_empty());
        assert!(cfg.env.is_empty());
    }
}
