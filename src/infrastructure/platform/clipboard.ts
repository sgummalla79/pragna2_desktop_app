/**
 * Platform-aware clipboard writes — the single home for `navigator.clipboard`
 * access in the frontend.
 *
 * Why this lives in the platform layer: the desktop ships **no** Tauri
 * clipboard plugin, so every copy goes through the webview's Async Clipboard
 * API. That API carries a platform-specific gotcha the rest of the app must not
 * have to remember: in WKWebView (the macOS Tauri webview) a clipboard write is
 * only permitted while the *user-gesture activation* is still live. Any `await`
 * between the click and `navigator.clipboard.write()` consumes that activation,
 * and the write is then rejected with `NotAllowedError` — which is exactly why
 * the diagram "Copy as PNG" silently failed on macOS while the (await-free)
 * message-text copy worked. See CLAUDE.md § Platform Abstraction and
 * docs/CODE_FIXES.md CF-053.
 *
 * The fix these helpers encode: accept the payload as a `Promise` so the
 * `ClipboardItem` is built and `clipboard.write()` is invoked **synchronously**
 * with the still-pending promise. The webview resolves the promise itself,
 * after the write call, so the production work (rasterising an SVG, re-rendering
 * a titled diagram) can be async without ever spending the gesture window.
 */

/**
 * MIME type for PNG clipboard images. The Async Clipboard API mandates
 * `image/png` as the only universally writable image type — both WKWebView and
 * Chromium WebView2 reject `image/jpeg` on `write()`. Spec-defined literal, kept
 * named here rather than inlined per the no-hardcoding rule.
 */
const CLIPBOARD_PNG_MIME = 'image/png';

/**
 * MIME type for plain-text clipboard payloads. Used for the promise-form text
 * write (e.g. copying SVG markup produced by async rendering). Spec-defined
 * literal, named not inlined.
 */
const CLIPBOARD_TEXT_MIME = 'text/plain';

/**
 * Copy text to the clipboard.
 *
 * - Ready `string`: written via `writeText` (the simplest path; this is what the
 *   message-copy action uses, since its text is already in hand).
 * - `Promise<string>`: routed through `clipboard.write()` with a `text/plain`
 *   {@link ClipboardItem} so the write fires synchronously while the user
 *   gesture is live, even though the text is produced by later async work (e.g.
 *   rendering a titled diagram to SVG markup). See the module note on WKWebView
 *   activation.
 *
 * @param text - The text, or a promise resolving to it.
 * @throws Re-throws any underlying clipboard error so callers can surface it —
 *   this never swallows failures.
 */
export async function copyText(text: string | Promise<string>): Promise<void> {
  if (typeof text === 'string') {
    await navigator.clipboard.writeText(text);
    return;
  }
  await navigator.clipboard.write([new ClipboardItem({ [CLIPBOARD_TEXT_MIME]: text })]);
}

/**
 * Copy a PNG image to the clipboard.
 *
 * Accepts the PNG as a ready `Blob` or — preferred when the blob comes from
 * async work such as rasterising an SVG to a canvas — as a `Promise<Blob>`. In
 * the promise form the {@link ClipboardItem} is constructed and
 * `clipboard.write()` is called immediately with the pending promise, so the
 * WKWebView user-gesture activation survives the rasterisation. Resolving the
 * blob before calling this (i.e. `await`-ing at the call site) would already
 * have spent the activation and the write would be rejected on macOS.
 *
 * @param png - The PNG blob, or a promise resolving to it.
 * @throws Re-throws any underlying clipboard error so callers can surface it —
 *   this never swallows failures.
 */
export async function copyImagePng(png: Blob | Promise<Blob>): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ [CLIPBOARD_PNG_MIME]: png })]);
}
