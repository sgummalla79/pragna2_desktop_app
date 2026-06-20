//! `MockMcpSpec` — serde mirror of `schema.ts`, kept in lockstep. Both the Node
//! mock and the standalone Rust mock deserialize this same declarative contract
//! so they stay behaviorally equivalent (verified by the conformance harness).
//!
//! Included into the Rust mock crate via `#[path = "../../spec/schema.rs"] mod schema;`
//! so the schema has a single home in `spec/` shared with the TS side.

use serde::Deserialize;

/// One canned outcome for a tool call. The Nth call uses
/// `responses[min(N, len - 1)]` (the last entry repeats).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockToolResponse {
    /// `"result" | "error" | "authError"`.
    pub kind: String,
    /// Delay before responding, ms — probes the host per-call timeout.
    #[serde(default)]
    pub call_delay_ms: u64,
    /// Result/error body text.
    #[serde(default)]
    pub content: Option<String>,
    /// For `authError`: an auth-signal substring to embed (e.g. `invalid_grant`).
    #[serde(default)]
    pub signal: Option<String>,
    /// For `authError`: emit `for provider '<x>'` so the host extracts the service.
    #[serde(default)]
    pub provider_in_error: Option<String>,
    /// `"isError"` (default) or `"raisedError"`.
    #[serde(default)]
    pub channel: Option<String>,
}

/// A tool exposed by the mock server.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockTool {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// JSON-Schema `inputSchema` object.
    #[serde(default)]
    pub input_schema: Option<serde_json::Value>,
    pub responses: Vec<MockToolResponse>,
}

/// Behavior of the `<command> auth [--provider <svc>]` re-auth subprocess.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockAuthBehavior {
    /// Exit code when the provider check passes (0 = success).
    #[serde(default)]
    pub exit_code: i32,
    /// When set, `auth` exits non-zero unless `--provider` matches.
    #[serde(default)]
    pub require_provider: Option<String>,
}

/// The full mock behavior spec.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockMcpSpec {
    #[serde(default)]
    pub server_name: Option<String>,
    /// Delay the initialize handshake, ms — probes the host startup timeout.
    #[serde(default)]
    pub startup_delay_ms: u64,
    pub tools: Vec<MockTool>,
    #[serde(default)]
    pub auth: MockAuthBehavior,
}

/// Build the flattened error text for an `authError` response. MUST match the
/// TypeScript `authErrorText` byte-for-byte so both mocks emit identical bodies.
pub fn auth_error_text(resp: &MockToolResponse) -> String {
    let provider = resp
        .provider_in_error
        .as_ref()
        .map(|p| format!("failed to fetch required token for provider '{p}': "))
        .unwrap_or_default();
    let signal = resp.signal.clone().unwrap_or_else(|| "401".to_string());
    let body = resp
        .content
        .clone()
        .unwrap_or_else(|| "authentication failed".to_string());
    format!("{provider}{body} ({signal})")
}
