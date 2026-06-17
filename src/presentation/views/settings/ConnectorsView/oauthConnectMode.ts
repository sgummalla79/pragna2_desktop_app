/**
 * Decide how an `oauth` connector should run its connect flow.
 *
 * A connector whose `config.oauth.callbackPort` is set uses a pre-registered
 * client + a fixed RFC 8252 loopback redirect; on the desktop we can complete it
 * end-to-end with a loopback listener. Otherwise (no `callbackPort`, OR not the
 * desktop runtime — a plain browser cannot bind a loopback port) we fall back to
 * the browser-redirect flow (open the URL; the server-side callback finishes it).
 *
 * The decision is gated on the RUNTIME (`isTauriRuntime()`), not just the config,
 * per CLAUDE.md § Platform Abstraction — this is the single place the connectors
 * UI makes that call, so both the card and the wizard branch identically.
 */

import { isTauriRuntime } from '@/infrastructure/platform';
import { readMcpOAuthConfig } from '@/domain/types/mcp.types';

export type OAuthConnectMode =
  | { mode: 'loopback'; callbackPort: number }
  | { mode: 'browser' };

/** Resolve the connect mode from a connector's opaque `config`. */
export function resolveOAuthConnectMode(
  config: Record<string, unknown>,
): OAuthConnectMode {
  const oauth = readMcpOAuthConfig(config);
  if (oauth && isTauriRuntime()) {
    return { mode: 'loopback', callbackPort: oauth.callbackPort };
  }
  return { mode: 'browser' };
}
