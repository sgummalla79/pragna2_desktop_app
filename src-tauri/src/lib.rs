pub mod adapters;
pub mod application;
pub mod domain;
pub mod platform;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// ── Secure store (OS keychain) ──────────────────────────────────────────────
// A thin cross-platform wrapper over the `keyring` crate (macOS Keychain /
// Windows Credential Manager) used to persist the auth refresh token across
// app restarts. See pragna2-tracker TD-009. The frontend (`secureStore.ts`)
// invokes these; all values are namespaced under one service.
//
// The KEYRING_SERVICE constant and any future platform-specific logic live in
// `src/platform/` (see CLAUDE.md § Platform Abstraction).

/// Store (or overwrite) a secret under `key` in the OS secure store.
///
/// A denied/cancelled keychain prompt (macOS Deny/Cancel, locked store, Windows
/// credential access denied) is treated as **"persistence skipped"** (`Ok(())`)
/// rather than a hard error: login still succeeds, the session just won't
/// survive a relaunch. The skip is logged, not silent. Other errors propagate.
#[tauri::command]
fn secure_store_set(key: String, value: String) -> Result<(), String> {
    let entry = keyring::Entry::new(platform::KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.set_password(&value) {
        Ok(()) => Ok(()),
        Err(e @ (keyring::Error::NoStorageAccess(_) | keyring::Error::PlatformFailure(_))) => {
            eprintln!(
                "[secure_store] keychain write unavailable for '{key}': {e}; \
                 session will not persist across relaunch"
            );
            Ok(())
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Read a secret by `key`; `None` when absent or when the OS keychain is
/// unavailable / access was denied.
///
/// A read can fail not only because nothing is stored (`NoEntry`) but because
/// the user dismissed the macOS keychain unlock prompt ("Deny"/Cancel) or the
/// store denied/locked access. Those cases are treated as **"no saved session"**
/// (`Ok(None)`) rather than a hard error, so the app falls back to interactive
/// login instead of failing startup. The degradation is logged, not silent.
/// Genuinely malformed-entry errors still propagate. See pragna2-tracker TD-009.
#[tauri::command]
fn secure_store_get(key: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(platform::KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        // Expected on first launch / after logout.
        Err(keyring::Error::NoEntry) => Ok(None),
        // Keychain denied access or the user dismissed the unlock prompt (macOS
        // Deny/Cancel, locked store, Windows credential access denied). Degrade
        // to "no saved session" so login can proceed.
        Err(e @ (keyring::Error::NoStorageAccess(_) | keyring::Error::PlatformFailure(_))) => {
            eprintln!(
                "[secure_store] keychain read unavailable for '{key}': {e}; \
                 treating as no saved session (will require interactive login)"
            );
            Ok(None)
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Delete a secret by `key`; a no-op when it doesn't exist.
#[tauri::command]
fn secure_store_delete(key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(platform::KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Warm registry of running local stdio MCP services (Phase F). Lazy —
        // empty until the first delegated tool call spawns a server.
        .manage(platform::mcp_registry::McpRegistry::default())
        .plugin(tauri_plugin_opener::init())
        // Loopback OAuth server for the production social-login flow: starts a
        // temporary localhost HTTP server that captures Auth0's redirect after
        // the user authenticates in the system browser (RFC 8252).
        .plugin(tauri_plugin_oauth::init())
        // Native HTTP client for the direct Auth0 calls (token exchange, ROPG
        // login, /userinfo, signup). Runs in Rust so the webview's CORS policy
        // doesn't apply — works identically in dev and a packaged build.
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            secure_store_set,
            secure_store_get,
            secure_store_delete,
            adapters::mcp_commands::mcp_stdio_discover,
            adapters::mcp_commands::mcp_stdio_call,
            adapters::mcp_commands::mcp_stdio_save_config,
            adapters::mcp_commands::mcp_stdio_clear_config,
            adapters::mcp_commands::mcp_stdio_auth
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
