/** True when running inside the Tauri webview (vs a plain browser / dev server).
 *  Tauri injects `__TAURI_INTERNALS__` onto `window`. */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** True when the app is running on Windows (Tauri or browser). */
export function isWindowsPlatform(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows');
}

/** True only when the Windows-native desktop chrome (custom title bar + the
 *  Windows-specific sidebar/layout branches) should be rendered: on Windows AND
 *  inside the Tauri runtime.
 *
 *  The Windows chrome exists solely because Tauri's `decorations: false` strips
 *  the native window frame — and the custom title bar calls Tauri-only window
 *  APIs (`getCurrentWindow`) at render. In a plain browser those assumptions are
 *  false: there is no Tauri runtime (so the title bar would dereference absent
 *  Tauri internals and crash the React tree) and the native frame is the
 *  browser's own. A Windows-UA browser — including the e2e Desktop Chrome device
 *  and any real browser on Windows — must therefore fall through to the default
 *  (web) chrome, NOT the Tauri-native Windows chrome. Gating on the runtime as
 *  well as the OS is what keeps browser-fallback rendering the default layout. */
export function usesWindowsChrome(): boolean {
  return isWindowsPlatform() && isTauriRuntime();
}
