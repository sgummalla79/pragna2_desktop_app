import { start, cancel, onUrl, onInvalidUrl } from '@fabianlars/tauri-plugin-oauth';
import { openUrl } from '@tauri-apps/plugin-opener';
import { isTauriRuntime } from '@/infrastructure/platform';
import type {
  IMcpOAuthLoopbackFlow,
  LoopbackCaptureResult,
} from '@/application/ports/IMcpOAuthLoopbackFlow';
import { MCP_OAUTH_LOOPBACK_TIMEOUT_MS } from '@/constants/mcpOAuth';
import { ERRORS } from '@/constants/errors';
import { PragnaError } from '@/domain/errors/PragnaError';
import { logger } from '@/infrastructure/logging/logger';
import { MCP_OAUTH_LOOPBACK_SUCCESS_HTML } from './loopbackSuccessPage';

/**
 * Parse a captured redirect into an absolute URL. `tauri-plugin-oauth` may hand
 * us either an absolute URL or a bare path/query; normalise both against the
 * known loopback origin.
 */
function toUrl(raw: string, origin: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(raw, origin);
    } catch {
      return null;
    }
  }
}

/**
 * Desktop MCP OAuth loopback capture (tracker #131) over
 * `@fabianlars/tauri-plugin-oauth` — the same RFC 8252 loopback plugin the
 * production Auth0 social-login flow uses ({@link TauriLoopbackAuthFlow}). No
 * new Rust/Tauri command is needed.
 *
 * Unlike the Auth0 flow, the authorization URL is **built by the backend** (its
 * `redirect_uri` already targets `http://localhost:{callbackPort}/callback`), so
 * this flow only binds the fixed port, opens the URL, and captures `code` +
 * `state`. The port CANNOT be substituted — the AS redirect URI is fixed to the
 * pre-registered `callbackPort`; if it is unavailable we fail with a clear error
 * rather than binding a different port.
 *
 * The loopback server can receive stray requests (favicon, probes) before/after
 * the real redirect, so the handler IGNORES anything without both `code` and
 * `state` and only fails on an explicit provider `error` or the overall timeout.
 */
export class TauriMcpOAuthLoopbackFlow implements IMcpOAuthLoopbackFlow {
  async capture(
    callbackPort: number,
    authorizationUrl: string,
  ): Promise<LoopbackCaptureResult> {
    if (!isTauriRuntime()) {
      // The loopback listener depends on the desktop runtime; it is not
      // available when the frontend is opened in a plain browser.
      logger.warn('mcp:oauth:loopback:not-tauri', { errorCode: 'CON_007' });
      throw new PragnaError(ERRORS.CON_007);
    }

    // Bind the connector's fixed callback port. A single-element pool means the
    // plugin either binds exactly this port or throws — there is no fallback,
    // because the AS redirect URI is registered to this exact port.
    let port: number;
    try {
      port = await start({
        ports: [callbackPort],
        response: MCP_OAUTH_LOOPBACK_SUCCESS_HTML,
      });
    } catch (err) {
      logger.fromError('mcp:oauth:loopback:port-unavailable', err, {
        callbackPort,
      });
      throw new PragnaError(ERRORS.CON_008, err);
    }

    if (port !== callbackPort) {
      // Defensive: the plugin bound a different port than the AS will redirect
      // to, so capture could never succeed. Tear it down and fail clearly.
      await cancel(port).catch(() => {
        /* server already gone */
      });
      logger.warn('mcp:oauth:loopback:port-mismatch', {
        errorCode: 'CON_008',
        requested: callbackPort,
        bound: port,
      });
      throw new PragnaError(ERRORS.CON_008);
    }

    const origin = `http://localhost:${callbackPort}`;
    logger.debug('mcp:oauth:loopback:listening', { origin });

    let timer: ReturnType<typeof setTimeout> | undefined;
    let unlisten: (() => void) | undefined;
    try {
      return await new Promise<LoopbackCaptureResult>((resolve, reject) => {
        timer = setTimeout(() => {
          logger.warn('mcp:oauth:loopback:timeout', { errorCode: 'CON_009' });
          reject(new PragnaError(ERRORS.CON_009));
        }, MCP_OAUTH_LOOPBACK_TIMEOUT_MS);

        void onUrl((raw) => {
          const url = toUrl(raw, origin);
          if (!url) {
            logger.debug('mcp:oauth:loopback:unparseable-request');
            return; // stray/unparseable request — keep waiting
          }
          const params = url.searchParams;
          const error = params.get('error');
          if (error) {
            logger.warn('mcp:oauth:loopback:provider-error', {
              errorCode: 'CON_007',
              error,
              description: params.get('error_description') ?? undefined,
            });
            reject(new PragnaError(ERRORS.CON_007));
            return;
          }
          const code = params.get('code');
          const state = params.get('state');
          if (!code || !state) {
            // Not the OAuth redirect (favicon, probe, etc.) — ignore, keep waiting.
            logger.debug('mcp:oauth:loopback:ignored-request', {
              path: url.pathname,
            });
            return;
          }
          logger.debug('mcp:oauth:loopback:captured', { path: url.pathname });
          resolve({ code, state });
        }).then((fn) => {
          unlisten = fn;
        });

        // The plugin emits this with a parse-error string for requests it can't
        // turn into a URL. Not actionable, so log and keep waiting.
        void onInvalidUrl((detail) => {
          logger.debug('mcp:oauth:loopback:invalid-url', { detail });
        });

        // Open the BE-built authorization URL in the user's default browser.
        openUrl(authorizationUrl).catch((err) => {
          logger.fromError('mcp:oauth:loopback:open-browser-failed', err);
          reject(new PragnaError(ERRORS.CON_007, err));
        });
      });
    } finally {
      if (timer) clearTimeout(timer);
      unlisten?.();
      await cancel(port).catch(() => {
        /* server already gone */
      });
    }
  }
}
