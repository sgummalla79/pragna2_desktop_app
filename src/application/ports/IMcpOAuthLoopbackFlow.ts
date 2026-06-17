/**
 * Port for the desktop MCP OAuth loopback capture (tracker #131).
 *
 * Abstracts the RFC 8252 native-app loopback listener used to finish a
 * pre-registered-client OAuth flow: bind the connector's fixed `callbackPort`,
 * open the authorization URL in the system browser, and capture the `code` +
 * `state` the authorization server redirects to `localhost:{port}/callback`.
 *
 * The application layer depends on this interface; the concrete implementation
 * (`@fabianlars/tauri-plugin-oauth`-backed) lives in
 * `src/infrastructure/mcp/tauriMcpOAuthLoopbackFlow.ts` and is desktop-only.
 */

/** The authorization code + signed state captured from the loopback redirect. */
export interface LoopbackCaptureResult {
  code: string;
  state: string;
}

export interface IMcpOAuthLoopbackFlow {
  /**
   * Bind `callbackPort`, open `authorizationUrl` in the system browser, and
   * resolve with the captured `code` + `state`.
   *
   * @param callbackPort The exact loopback port the AS will redirect to (from
   *   `config.oauth.callbackPort`). Cannot be substituted — the AS redirect URI
   *   is fixed to this port.
   * @param authorizationUrl The BE-built authorization URL (its `redirect_uri`
   *   already targets `http://localhost:{callbackPort}/callback`).
   * @returns The captured authorization code + state.
   * @throws PragnaError on port-in-use, provider error, timeout, or when the
   *   desktop (Tauri) runtime is unavailable.
   */
  capture(
    callbackPort: number,
    authorizationUrl: string,
  ): Promise<LoopbackCaptureResult>;
}
