pub mod adapters;
pub mod application;
pub mod domain;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// ── Secure store (OS keychain) ──────────────────────────────────────────────
// A thin cross-platform wrapper over the `keyring` crate (macOS Keychain /
// Windows Credential Manager) used to persist the auth refresh token across
// app restarts. See docs/TODO.md TD-009. The frontend (`secureStore.ts`)
// invokes these; all values are namespaced under one service.

/// Keychain service name all secrets are stored under (the app bundle id).
const KEYRING_SERVICE: &str = "com.pragna2.app";

/// Store (or overwrite) a secret under `key` in the OS secure store.
#[tauri::command]
fn secure_store_set(key: String, value: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

/// Read a secret by `key`; `None` when absent.
#[tauri::command]
fn secure_store_get(key: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Delete a secret by `key`; a no-op when it doesn't exist.
#[tauri::command]
fn secure_store_delete(key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            secure_store_delete
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
