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

/// Outcome of a delegated stdio tool call (tracker #124).
///
/// A normal call yields [`DelegatedCallOutcome::Result`] (the flattened content
/// the LLM sees). When the aggregator's DOWNSTREAM-service token (e.g. GUS inside
/// an `mcp-adaptor`) is dead, the call yields [`DelegatedCallOutcome::AuthRequired`]
/// instead — NOT an error — so the frontend can relay a structured `auth_required`
/// result to the backend and the run pauses for a per-service re-auth card rather
/// than handing the raw auth error to the LLM.
///
/// Serialised to the frontend with an internal `kind` tag:
/// `{ "kind": "result", "content": "…" }` or
/// `{ "kind": "auth_required", "service": "gus", "reason": "token_expired" }`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DelegatedCallOutcome {
    /// A normal tool result (success or a non-auth error body).
    Result {
        /// The flattened result content for the LLM.
        content: String,
    },
    /// The downstream service needs (re-)authentication.
    AuthRequired {
        /// The downstream provider (e.g. `gus`), or `None` when it could not be
        /// derived from the connector's launch config.
        service: Option<String>,
        /// Why re-auth is needed — see [`REAUTH_REASON_TOKEN_EXPIRED`].
        reason: String,
    },
}

/// Conservative, case-insensitive substrings that mark a tool result (or a raised
/// call error) as an AUTHENTICATION failure rather than a normal outcome
/// (tracker #122/#124). MIRRORS pragna2-api `MCP_AUTH_ERROR_RESULT_SIGNALS` so the
/// desktop classifies exactly as the backend's text-signal fallback would — a
/// drift here would re-introduce the #122 silent-explain or a spurious pause.
/// Deliberately specific: a false positive only costs a pause the user can
/// dismiss with "Continue"; a miss re-introduces the silent-explain.
pub const AUTH_ERROR_RESULT_SIGNALS: &[&str] = &[
    "invalid_session_id",
    "401",
    "403",
    "unauthorized",
    "forbidden",
    "token expired",
    "token has expired",
    "expired token",
    "invalid_token",
    "invalid token",
    "stale session",
    "session expired",
    "authentication failed",
    "not authenticated",
    "re-authenticate",
    "reauthenticate",
    "www-authenticate",
];

/// Launch-config arg flags whose value names the downstream provider for an
/// aggregator (`mcp-adaptor --server gus` / `--provider gus`). The same value is
/// reused as `auth --provider <service>` to drive that service's re-auth.
/// Revisit if a single connector ever aggregates multiple providers (tracker
/// #124 open question).
pub const PROVIDER_ARG_FLAGS: &[&str] = &["--server", "--provider"];

/// Default re-auth reason when an auth-looking failure carries no definitive
/// revocation signal (the common aggregator case). MIRRORS pragna2-api
/// `MCP_REAUTH_REASON_TOKEN_EXPIRED`.
pub const REAUTH_REASON_TOKEN_EXPIRED: &str = "token_expired";

/// True when `text` contains any [`AUTH_ERROR_RESULT_SIGNALS`] substring
/// (case-insensitive) — i.e. it looks like an authentication failure.
pub fn is_auth_error_signal(text: &str) -> bool {
    let lower = text.to_lowercase();
    AUTH_ERROR_RESULT_SIGNALS
        .iter()
        .any(|signal| lower.contains(signal))
}

/// Derive the downstream provider (e.g. `gus`) from a connector's launch-config
/// `args`: the value immediately following the first [`PROVIDER_ARG_FLAGS`] flag.
/// `None` when no provider flag is present (the frontend then sends
/// `service: null` and the card shows a generic message).
pub fn service_from_args(args: &[String]) -> Option<String> {
    let mut iter = args.iter();
    while let Some(arg) = iter.next() {
        if PROVIDER_ARG_FLAGS.contains(&arg.as_str()) {
            return iter.next().cloned();
        }
        // Also support `--server=gus` / `--provider=gus`.
        for flag in PROVIDER_ARG_FLAGS {
            if let Some(value) = arg.strip_prefix(&format!("{flag}=")) {
                if !value.is_empty() {
                    return Some(value.to_string());
                }
            }
        }
    }
    None
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
            args: vec![
                "-y".into(),
                "@scope/server".into(),
                "--profile".into(),
                "x".into(),
            ],
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
        let cfg: StdioLaunchConfig = serde_json::from_str(r#"{"command":"my-server"}"#).unwrap();
        assert_eq!(cfg.command, "my-server");
        assert!(cfg.args.is_empty());
        assert!(cfg.env.is_empty());
    }

    #[test]
    fn auth_signal_matches_case_insensitively_and_as_substring() {
        assert!(is_auth_error_signal("Error: INVALID_SESSION_ID"));
        assert!(is_auth_error_signal("HTTP 401 Unauthorized"));
        assert!(is_auth_error_signal(
            "the session expired, please re-authenticate"
        ));
        assert!(is_auth_error_signal("WWW-Authenticate: Bearer"));
    }

    #[test]
    fn auth_signal_ignores_clearly_non_auth_text() {
        assert!(!is_auth_error_signal("ok"));
        assert!(!is_auth_error_signal(r#"{"rows": 7, "status": "done"}"#));
        assert!(!is_auth_error_signal("no results found"));
    }

    #[test]
    fn auth_signal_is_a_conservative_substring_matcher() {
        // "401"/"403" are matched as bare substrings, so a value like 4012 trips
        // them. This is the BE's accepted cost (MCP_AUTH_ERROR_RESULT_SIGNALS):
        // the desktop only classifies AuthRequired when the result ALSO carries
        // isError=true (see mcp_registry::call), so a successful body like this
        // never reaches the classifier — and a false positive otherwise only
        // costs a pause the user can dismiss with "Continue".
        assert!(is_auth_error_signal(r#"{"rows": 4012}"#));
    }

    #[test]
    fn service_from_args_reads_server_flag() {
        let args = vec![
            "--server".to_string(),
            "gus".to_string(),
            "--verbose".to_string(),
        ];
        assert_eq!(service_from_args(&args), Some("gus".to_string()));
    }

    #[test]
    fn service_from_args_reads_provider_flag() {
        let args = vec![
            "serve".to_string(),
            "--provider".to_string(),
            "google".to_string(),
        ];
        assert_eq!(service_from_args(&args), Some("google".to_string()));
    }

    #[test]
    fn service_from_args_reads_equals_form() {
        let args = vec!["--server=search".to_string()];
        assert_eq!(service_from_args(&args), Some("search".to_string()));
    }

    #[test]
    fn service_from_args_none_when_no_provider_flag() {
        let args = vec!["-y".to_string(), "@scope/server".to_string()];
        assert_eq!(service_from_args(&args), None);
    }

    #[test]
    fn outcome_serialises_with_kind_tag() {
        let result = DelegatedCallOutcome::Result {
            content: "hello".into(),
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["kind"], "result");
        assert_eq!(json["content"], "hello");

        let auth = DelegatedCallOutcome::AuthRequired {
            service: Some("gus".into()),
            reason: REAUTH_REASON_TOKEN_EXPIRED.into(),
        };
        let json = serde_json::to_value(&auth).unwrap();
        assert_eq!(json["kind"], "auth_required");
        assert_eq!(json["service"], "gus");
        assert_eq!(json["reason"], "token_expired");
    }
}
