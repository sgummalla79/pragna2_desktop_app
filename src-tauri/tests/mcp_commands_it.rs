//! Adapter-level integration tests for the Tauri MCP command boundary
//! (`adapters::mcp_commands`), driven against the WI-1 mock fixture
//! (pragna2-tracker #162). The `#169`/`#170` suites cover the host/registry
//! orchestration directly; these pin the *command* layer that the frontend
//! actually invokes — that it forwards args to the host and serialises the
//! result / error as the FE expects (`Result<Vec<ToolSchema>, String>`).
//!
//! Only `mcp_stdio_discover` is exercised here: it is the one command with no
//! `State`/keychain dependency, so it can be called as a plain async fn with an
//! explicit `StdioLaunchConfig` and never touches the OS keychain. The
//! `parse_id` error branch shared by the `State`/keychain commands is covered by
//! the in-file unit tests in `adapters/mcp_commands.rs`.

mod common;

use common::launch;
use pragna2_desktop_app_lib::adapters::mcp_commands::mcp_stdio_discover;
use std::collections::HashMap;

/// Happy path: the command forwards to the host and serialises the discovered
/// tools as the `Vec<ToolSchema>` shape the frontend consumes.
#[tokio::test]
async fn discover_command_returns_the_serialised_tool_list() {
    let cfg = launch("multi-tool", &[]);
    let tools = mcp_stdio_discover(cfg.command, cfg.args, cfg.env)
        .await
        .expect("discover command should succeed");

    let mut names: Vec<_> = tools.iter().map(|t| t.name.clone()).collect();
    names.sort();
    assert_eq!(names, vec!["fetch", "search", "summarize"]);
}

/// A host error must surface to the frontend as a serialised `String` (the
/// command's `Err` arm), never as a Rust panic.
#[tokio::test]
async fn discover_command_surfaces_host_error_as_a_string() {
    let err = mcp_stdio_discover(
        "definitely-not-a-real-binary-xyz".to_string(),
        vec![],
        HashMap::new(),
    )
    .await
    .expect_err("a bad command should fail to spawn");

    assert!(
        !err.is_empty(),
        "the host error must serialise to a non-empty message string"
    );
}
