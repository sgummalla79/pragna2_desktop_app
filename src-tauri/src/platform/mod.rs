/// Platform abstraction layer — the ONLY place in the Rust codebase that may
/// contain `#[cfg(target_os = …)]` or `#[cfg(windows)]` attributes.
///
/// Rule (see CLAUDE.md § Platform Abstraction):
///   Adding platform-conditional Rust code means adding it here, never in
///   lib.rs, domain, application, or adapters.

/// Name of the OS keychain service all secrets are stored under.
/// Matches the Tauri app identifier so credentials are scoped to this app.
/// Used by the `keyring` crate on macOS (Keychain) and Windows (Credential Manager).
pub const KEYRING_SERVICE: &str = "com.pragna2.app";

/// Warm stdio-MCP process registry + keychain launch-config store (Phase F).
pub mod mcp_registry;
