/** Result of a completed authorization-code redirect captured from the browser. */
export interface AuthorizationResult {
  /** The authorization `code` Auth0 returned on the redirect. */
  code: string;
  /** The `state` value Auth0 echoed back (validated by the caller for CSRF). */
  state: string;
  /**
   * The redirect URI actually used (the loopback bound to a free port). The
   * token exchange MUST send this same value, so it is returned rather than
   * assumed — the bound port is only known after the server starts.
   */
  redirectUri: string;
}

/**
 * Drives an OAuth 2.0 authorization-code flow through an EXTERNAL user-agent
 * (the system browser), per RFC 8252 §8. The implementation is responsible for:
 *   1. preparing a redirect URI it can listen on,
 *   2. opening `buildAuthorizeUrl(redirectUri)` in the system browser,
 *   3. capturing the redirect and resolving the `code` + `state`.
 *
 * Abstracting this keeps {@link Auth0Repository} free of any desktop-runtime
 * (Tauri) details — the concrete loopback implementation is injected.
 */
export interface IExternalAuthorizationFlow {
  /**
   * Runs the full browser round-trip and resolves once the redirect is captured.
   * The implementation chooses the redirect URI (e.g. a free loopback port) and
   * returns it in the result so the caller can reuse it for the token exchange.
   * @param buildAuthorizeUrl builds the provider `/authorize` URL for a redirect URI.
   */
  authorize(buildAuthorizeUrl: (redirectUri: string) => string): Promise<AuthorizationResult>;
}
