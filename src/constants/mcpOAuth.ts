/**
 * Constants for the MCP pre-registered-client OAuth (loopback) flow.
 *
 * A connector whose authorization server uses a pre-registered OAuth app +
 * a fixed RFC 8252 loopback redirect carries a generic, product-agnostic
 * `config.oauth = { clientId, loginUrl, callbackPort }` block. These keys are
 * part of the backend contract (pragna2-api #130 — see
 * `docs/architecture/mcp-system.md` § "Pre-registered client config"); they are
 * stored as opaque camelCase JSON on `connector.config` (no mapper translation).
 *
 * Centralised here so a contract drift is a one-line edit and never an inline
 * literal in component / flow logic (CLAUDE.md § No Hardcoding).
 */

/** Key of the pre-registered OAuth block within a connector's opaque `config`. */
export const MCP_OAUTH_CONFIG_KEY = 'oauth';

/** Inner keys of the `config.oauth` block (camelCase, per the BE contract). */
export const MCP_OAUTH_CLIENT_ID_KEY = 'clientId';
export const MCP_OAUTH_LOGIN_URL_KEY = 'loginUrl';
export const MCP_OAUTH_CALLBACK_PORT_KEY = 'callbackPort';
/** When true the backend omits the RFC 8707 resource param from the token
 *  exchange (tracker #136 / #137). Required for Salesforce — its token endpoint
 *  rejects the param with invalid_grant. */
export const MCP_OAUTH_OMIT_RESOURCE_KEY = 'omitResourceAtTokenExchange';

/**
 * Path the authorization server redirects to on the loopback host
 * (`http://localhost:{callbackPort}/callback`). The listener resolves on any
 * request carrying both `code` and `state`, so this is documentation of the
 * contract rather than a match key.
 */
export const MCP_OAUTH_LOOPBACK_PATH = '/callback';

/**
 * How long to wait for the user to finish authenticating in the system browser
 * before tearing down the loopback listener. Mirrors the Auth0 loopback timeout.
 */
export const MCP_OAUTH_LOOPBACK_TIMEOUT_MS = 180_000;

/** Lowest / highest valid TCP port (exclusive bounds) for `callbackPort`. */
export const MIN_TCP_PORT = 0;
export const MAX_TCP_PORT = 65536;
