//! Integration tests for the `mcp_host::auth` re-auth subprocess path
//! (pragna2-tracker #169), driven against the WI-1 mock fixture's `auth`
//! subcommand. `auth` runs `<command> auth [--provider <svc>]` and maps the exit
//! status to a result — these tests pin that mapping with a real subprocess.
//!
//! `auth(command, service)` takes an explicit command and inherits the parent's
//! environment, so the mock spec is supplied via `MOCK_MCP_SPEC` on the process
//! env. To avoid env races, the env-dependent assertions live in ONE test
//! function (mcp_host's own keychain-backed `call`/`reauth` are covered/gated
//! elsewhere — they hit the real OS keychain).

mod common;

use common::{mock_bin, preset_path};
use pragna2_desktop_app_lib::application::mcp_host;
use pragna2_desktop_app_lib::domain::mcp::McpHostError;

#[tokio::test]
async fn auth_subprocess_exit_status_maps_to_results() {
    let bin = mock_bin().to_string_lossy().into_owned();

    // reauth-success: requireProvider=gus, exitCode=0.
    std::env::set_var("MOCK_MCP_SPEC", preset_path("reauth-success"));
    // Matching provider → process exits 0 → Ok.
    mcp_host::auth(&bin, Some("gus"))
        .await
        .expect("auth with the required provider should succeed");
    // Wrong provider → process exits non-zero → Protocol.
    let err = mcp_host::auth(&bin, Some("not-gus"))
        .await
        .expect_err("auth with the wrong provider should fail");
    assert!(
        matches!(err, McpHostError::Protocol(_)),
        "expected Protocol, got {err:?}"
    );

    // reauth-failure: exitCode=1 unconditionally → Protocol.
    std::env::set_var("MOCK_MCP_SPEC", preset_path("reauth-failure"));
    let err = mcp_host::auth(&bin, None)
        .await
        .expect_err("a non-zero auth exit should fail");
    assert!(
        matches!(err, McpHostError::Protocol(_)),
        "expected Protocol, got {err:?}"
    );
}

#[tokio::test]
async fn auth_with_a_bad_command_is_a_spawn_error() {
    let err = mcp_host::auth("definitely-not-a-real-binary-xyz", None)
        .await
        .expect_err("a missing binary should fail to spawn");
    assert!(
        matches!(err, McpHostError::Spawn(_)),
        "expected Spawn, got {err:?}"
    );
}
