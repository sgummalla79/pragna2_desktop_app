//! Timeout-path integration tests for the stdio MCP host (pragna2-tracker #170).
//!
//! Uses the env-overridable bounds (`MCP_STARTUP_TIMEOUT_MS` /
//! `MCP_CALL_TIMEOUT_MS`) to exercise `McpHostError::Timeout` in well under a
//! second instead of the 30s / 120s production defaults. Lives in its OWN test
//! binary, and the two cases run sequentially in one function, so the reduced
//! bound never bleeds into the other integration tests (separate process) or
//! across cases.

mod common;

use common::launch;
use pragna2_desktop_app_lib::domain::mcp::McpHostError;
use pragna2_desktop_app_lib::platform::mcp_registry::McpRegistry;
use serde_json::json;
use uuid::Uuid;

#[tokio::test]
async fn startup_and_call_timeouts_are_enforced() {
    // Handshake hang: the `startup-delay` mock sleeps 60s before serving, so a
    // 200ms startup bound must surface Timeout (and the dropped future kills the
    // child via kill_on_drop — no lingering 60s process).
    std::env::set_var("MCP_STARTUP_TIMEOUT_MS", "200");
    let err = McpRegistry::discover(&launch("startup-delay", &[]))
        .await
        .expect_err("a slow handshake should time out");
    assert!(
        matches!(err, McpHostError::Timeout),
        "expected Timeout, got {err:?}"
    );
    std::env::remove_var("MCP_STARTUP_TIMEOUT_MS");

    // Hung tool call: the `call-delay` mock starts immediately but its tool sleeps
    // 130s, so a 200ms call bound must surface Timeout (startup left at default).
    std::env::set_var("MCP_CALL_TIMEOUT_MS", "200");
    let reg = McpRegistry::default();
    let err = reg
        .call(
            Uuid::new_v4(),
            &launch("call-delay", &[]),
            "slow",
            json!({}),
        )
        .await
        .expect_err("a hung tool call should time out");
    assert!(
        matches!(err, McpHostError::Timeout),
        "expected Timeout, got {err:?}"
    );
    std::env::remove_var("MCP_CALL_TIMEOUT_MS");
}
