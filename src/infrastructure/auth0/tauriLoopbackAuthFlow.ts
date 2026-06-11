import { start, cancel, onUrl, onInvalidUrl } from '@fabianlars/tauri-plugin-oauth';
import { openUrl } from '@tauri-apps/plugin-opener';
import { isTauriRuntime } from '@/infrastructure/platform';
import type {
  AuthorizationResult,
  IExternalAuthorizationFlow,
} from '@/application/ports/IExternalAuthorizationFlow';
import { AUTH0_LOOPBACK_PORTS, loopbackRedirectUri } from '@/constants/auth0';
import { ERRORS } from '@/constants/errors';
import { PragnaError } from '@/domain/errors/PragnaError';
import { logger } from '@/infrastructure/logging/logger';

// How long to wait for the user to finish authenticating in the browser before
// giving up and tearing down the loopback server.
const AUTH_TIMEOUT_MS = 180_000;

// Branded page shown in the system browser once the redirect lands. Must be
// fully self-contained (no external assets) — it renders outside the app. The
// plugin injects its URL-capture <script> into this page's <head>, so branding
// it does NOT interfere with capturing the auth code. Colours mirror the app's
// dark theme; the copper mark is the Pragna logo, inlined.
const SUCCESS_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pragna — Signed in</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0; display: flex; align-items: center; justify-content: center;
    background: #0b0b0c; color: #f2f3f5;
    font-family: "Open Sans", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .card {
    position: relative; width: 100%; max-width: 420px; margin: 24px;
    padding: 44px 36px 32px; text-align: center; overflow: hidden;
    background: #16181c; border: 1px solid #2a2d31; border-radius: 20px;
    box-shadow: 0 24px 70px rgba(0,0,0,.55);
  }
  .card::before {
    content: ""; position: absolute; inset: 0 0 auto 0; height: 3px;
    background: #1d9bf0;
  }
  .logo { width: 60px; height: 60px; display: block; margin: 0 auto 18px; }
  .check {
    width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;
    border-radius: 999px; background: rgba(34,197,94,.15); margin-bottom: 14px;
  }
  .check svg { width: 18px; height: 18px; }
  h1 { margin: 0 0 8px; font-size: 21px; font-weight: 700; letter-spacing: -.01em; }
  p { margin: 0 auto; max-width: 300px; font-size: 14px; line-height: 1.55; color: #8b8f96; }
  .brand {
    margin-top: 24px; font-size: 11px; font-weight: 600; letter-spacing: .14em;
    text-transform: uppercase; color: #5b6066;
  }
</style>
</head>
<body>
  <div class="card">
    <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <g stroke="#c97040" stroke-width="3.5">
        <polygon fill="none" stroke-linejoin="round" points="50,3 60.4,13.2 73.2,9.7 77.5,23 90.3,27.2 87,40.9 97,50 87,59.1 90.3,72.8 77.5,77 73.2,90.3 60.4,86.8 50,97 39.6,86.8 26.8,90.3 22.5,77 9.7,72.8 13,59.1 3,50 13,40.9 9.7,27.2 22.5,23 26.8,9.7 39.6,13.2"/>
        <circle cx="50" cy="50" r="33"/>
        <circle cx="50" cy="50" r="16"/>
        <circle cx="50" cy="50" r="8" fill="#c97040" fill-opacity="0.2" stroke-width="3.8"/>
      </g>
      <circle cx="50" cy="50" r="4" fill="#c97040"/>
    </svg>
    <div class="check">
      <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5"/>
      </svg>
    </div>
    <h1>You're signed in to Pragna</h1>
    <p>Authentication successful. You can safely close this window and return to the app.</p>
    <div class="brand">Pragna</div>
  </div>
  <script>window.setTimeout(function(){ try { window.close(); } catch (e) {} }, 2000);</script>
</body>
</html>`;

/**
 * Parse a captured redirect into an absolute URL. tauri-plugin-oauth may hand us
 * either an absolute URL or a bare path/query; normalise both against the known
 * loopback origin.
 */
function toUrl(raw: string, redirectUri: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(raw, new URL(redirectUri).origin);
    } catch {
      return null;
    }
  }
}

/**
 * Production social-login flow (RFC 8252 loopback): opens the provider's login
 * page in the user's SYSTEM browser — so their existing signed-in accounts /
 * SSO sessions are available (the account chooser) — and captures Auth0's
 * redirect on a temporary localhost server (tauri-plugin-oauth). PKCE
 * throughout; ports come from a pre-registered pool so the redirect URI stays
 * registrable in Auth0. Works identically in dev and a packaged build.
 *
 * The loopback server can receive stray requests (favicon, probes) before/after
 * the real redirect, so the handler IGNORES anything without a `code` and only
 * fails on an explicit provider `error` or the overall timeout.
 */
export class TauriLoopbackAuthFlow implements IExternalAuthorizationFlow {
  async authorize(
    buildAuthorizeUrl: (redirectUri: string) => string
  ): Promise<AuthorizationResult> {
    if (!isTauriRuntime()) {
      // Social login depends on the desktop runtime's loopback server; it is not
      // available when the frontend is opened in a plain browser (`pnpm dev`).
      logger.warn('auth:loopback:not-tauri', { errorCode: 'AUTH_006' });
      throw new PragnaError(ERRORS.AUTH_006);
    }

    // Bind the first free port from the pre-registered pool. If they're all
    // taken (e.g. several instances running), surface a clear error rather than
    // silently failing — every port here must also be registered in Auth0.
    let port: number;
    try {
      // Branded success page. The plugin injects its URL-capture <script> into
      // this HTML's <head>, so customising it doesn't affect code capture.
      port = await start({ ports: AUTH0_LOOPBACK_PORTS, response: SUCCESS_HTML });
    } catch (err) {
      logger.fromError('auth:loopback:no-free-port', err, {
        ports: AUTH0_LOOPBACK_PORTS.join(','),
      });
      throw new PragnaError(ERRORS.AUTH_006, err);
    }

    const redirectUri = loopbackRedirectUri(port);
    logger.debug('auth:loopback:listening', { redirectUri });

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<AuthorizationResult>((resolve, reject) => {
        timer = setTimeout(() => {
          logger.warn('auth:loopback:timeout', { errorCode: 'AUTH_009' });
          reject(new PragnaError(ERRORS.AUTH_009));
        }, AUTH_TIMEOUT_MS);

        void onUrl((raw) => {
          const url = toUrl(raw, redirectUri);
          if (!url) {
            logger.debug('auth:loopback:unparseable-request');
            return; // stray/unparseable request — keep waiting
          }
          const params = url.searchParams;
          const error = params.get('error');
          if (error) {
            logger.warn('auth:loopback:provider-error', {
              errorCode: 'AUTH_006',
              error,
              description: params.get('error_description') ?? undefined,
            });
            reject(new PragnaError(ERRORS.AUTH_006));
            return;
          }
          const code = params.get('code');
          const state = params.get('state');
          if (!code || !state) {
            // Not the OAuth redirect (favicon, probe, etc.) — ignore, keep waiting.
            logger.debug('auth:loopback:ignored-request', { path: url.pathname });
            return;
          }
          logger.debug('auth:loopback:captured', { path: url.pathname });
          resolve({ code, state, redirectUri });
        });

        // The plugin emits this with a parse-error string for requests it can't
        // turn into a URL. Not actionable, so log and keep waiting.
        void onInvalidUrl((detail) => {
          logger.debug('auth:loopback:invalid-url', { detail });
        });

        // Open the provider's /authorize page in the user's default browser.
        openUrl(buildAuthorizeUrl(redirectUri)).catch((err) => {
          logger.fromError('auth:loopback:open-browser-failed', err);
          reject(new PragnaError(ERRORS.AUTH_006, err));
        });
      });
    } finally {
      if (timer) clearTimeout(timer);
      await cancel(port).catch(() => { /* server already gone */ });
    }
  }
}
