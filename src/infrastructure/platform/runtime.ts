/** True when running inside the Tauri webview (vs a plain browser / dev server).
 *  Tauri injects `__TAURI_INTERNALS__` onto `window`. */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** True when the app is running on Windows (Tauri or browser). */
export function isWindowsPlatform(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows');
}
