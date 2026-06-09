import { fetch as tauriPluginFetch } from '@tauri-apps/plugin-http';

/** True when running inside the Tauri webview (native HTTP available). */
function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * A `fetch` implementation that bypasses the webview's CORS policy.
 *
 * In the desktop app, requests go through Tauri's `@tauri-apps/plugin-http`
 * `fetch`, which performs the request natively (no CORS) and — verified against
 * plugin v2.5.9 — streams the response body incrementally via a `ReadableStream`
 * (it pulls chunks through `plugin:http|fetch_read_body`). That streaming
 * behaviour is what makes token-by-token SSE chat work over the native
 * transport. The plugin also honours `init.signal`, so AbortController-driven
 * cancellation (the Stop button) propagates to the Rust side.
 *
 * In a plain browser (`pnpm dev`), it falls back to the global `fetch`. This
 * mirrors the `isTauriRuntime()` switch the axios client uses for its native
 * adapter (see `axiosClient.ts`).
 */
export const httpFetch: typeof fetch = isTauriRuntime()
  ? (tauriPluginFetch as unknown as typeof fetch)
  : globalThis.fetch.bind(globalThis);
