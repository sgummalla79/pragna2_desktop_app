/**
 * Platform-aware "open this URL in the user's browser" capability.
 *
 * Why this lives in the platform layer: in the Tauri webview a bare
 * `<a href="https://…">` click either does nothing or navigates the *app's own*
 * webview — replacing the running UI with the remote page and breaking the app.
 * The correct behaviour is to hand the URL to the OS so it opens in the system
 * browser. Tauri exposes this through `@tauri-apps/plugin-opener`; a plain
 * browser (dev server / e2e, which can report any OS) instead opens a new tab.
 * Gating on {@link isTauriRuntime} — not the OS — keeps that browser fallback on
 * the `window.open` path. See CLAUDE.md § Platform Abstraction.
 *
 * Used by assistant-markdown links (a deep-research "## References" section is
 * full of `[title](url)` links — see pragna2_desktop_app#99, moved from
 * nexus-kit-tracker #238) and any other place that must route a user-facing URL
 * to the system browser.
 */
import { isTauriRuntime } from './runtime';

/**
 * URL schemes we are willing to hand to the system browser. Restricted to web
 * schemes so a model-emitted or otherwise untrusted href cannot drive the
 * opener into a `file:`, `javascript:` or custom-scheme target. These are
 * `URL.protocol` values (spec-defined, hence trailing colon) — required
 * literals, kept named here rather than inlined.
 */
const EXTERNAL_LINK_ALLOWED_SCHEMES: readonly string[] = ['http:', 'https:'];

/**
 * Whether {@link openExternal} will accept this URL — i.e. it parses as an
 * absolute URL whose scheme is in {@link EXTERNAL_LINK_ALLOWED_SCHEMES}.
 *
 * Callers use this to decide whether to intercept a click at all; a `false`
 * result means "leave the default behaviour alone" (e.g. a blocked
 * `sandbox:`/`mailto:` href the renderer already degraded to plain text).
 *
 * @param url - Candidate URL (typically an anchor's `href`).
 */
export function isExternallyOpenableUrl(url: string): boolean {
  try {
    return EXTERNAL_LINK_ALLOWED_SCHEMES.includes(new URL(url).protocol);
  } catch {
    // Not an absolute URL (relative href, malformed string) — not openable.
    return false;
  }
}

/**
 * Open a URL in the system browser, choosing the transport by runtime.
 *
 * - Tauri runtime: routes through `@tauri-apps/plugin-opener`'s `openUrl`, which
 *   hands the URL to the OS default browser (never the app webview).
 * - Plain browser (dev / e2e): opens a new tab via `window.open` with
 *   `noopener,noreferrer` so the opened page cannot reach back into this window.
 *
 * @param url - The URL to open. Must satisfy {@link isExternallyOpenableUrl}.
 * @throws {RangeError} If `url` is not an allowed external URL — never silently
 *   no-ops, so a caller that skipped the {@link isExternallyOpenableUrl} guard
 *   gets an explicit failure rather than a dead click.
 * @throws Re-throws any underlying opener/transport error so the caller can
 *   surface the failure (this never swallows errors).
 */
export async function openExternal(url: string): Promise<void> {
  if (!isExternallyOpenableUrl(url)) {
    throw new RangeError(`Refusing to open non-web URL externally: ${url}`);
  }

  if (!isTauriRuntime()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(url);
}
