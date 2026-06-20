// Shared across multiple test binaries; not every binary uses every helper.
#![allow(dead_code)]

//! Shared helpers for the stdio MCP host integration tests.
//!
//! These tests spawn the WI-1 mock fixture (`test-fixtures/mock-mcp`, see
//! pragna2-tracker #168/#169) as a REAL subprocess and drive the production host
//! (`McpRegistry`, `mcp_host`) against it. The standalone Rust mock binary is the
//! spawn target — it is a single executable (works for both the MCP `serve` path
//! and the `auth` subcommand) and is self-built here, so the tests are hermetic
//! (no Node, no npm install, no network).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use pragna2_desktop_app_lib::domain::mcp::StdioLaunchConfig;

/// Repo root (parent of the `src-tauri` manifest dir).
fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri has a parent")
        .to_path_buf()
}

/// The standalone mock crate directory.
fn mock_crate_dir() -> PathBuf {
    repo_root().join("test-fixtures/mock-mcp/rust")
}

/// Absolute path to a shared preset JSON.
pub fn preset_path(name: &str) -> PathBuf {
    repo_root()
        .join("test-fixtures/mock-mcp/spec/presets")
        .join(format!("{name}.json"))
}

/// Build the standalone Rust mock once per test-binary process and return the
/// path to its binary. Building is idempotent + cached by Cargo; the mock has its
/// own `target/` dir so there is no lock contention with this crate's build.
pub fn mock_bin() -> &'static Path {
    static BIN: OnceLock<PathBuf> = OnceLock::new();
    BIN.get_or_init(|| {
        let dir = mock_crate_dir();
        let status = std::process::Command::new(env!("CARGO"))
            .arg("build")
            .current_dir(&dir)
            .status()
            .expect("spawn `cargo build` for the mock crate");
        assert!(status.success(), "mock crate failed to build");
        let bin = dir.join("target/debug/mock_mcp_server");
        assert!(
            bin.exists(),
            "mock binary missing after build: {}",
            bin.display()
        );
        bin
    })
    .as_path()
}

/// A launch config that runs the mock binary with `MOCK_MCP_SPEC=<preset>` and
/// the given extra args (e.g. `--server gus` to exercise arg-based service
/// derivation).
pub fn launch(preset: &str, extra_args: &[&str]) -> StdioLaunchConfig {
    let mut env = HashMap::new();
    env.insert(
        "MOCK_MCP_SPEC".to_string(),
        preset_path(preset).to_string_lossy().into_owned(),
    );
    StdioLaunchConfig {
        command: mock_bin().to_string_lossy().into_owned(),
        args: extra_args.iter().map(|s| s.to_string()).collect(),
        env,
    }
}
