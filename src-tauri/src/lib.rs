pub mod adapters;
pub mod application;
pub mod domain;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
