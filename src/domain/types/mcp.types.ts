/**
 * Domain types for MCP (Model Context Protocol) connector registrations.
 *
 * FE for `/api/mcp-connectors/*`. The BE serialises in snake_case; mappers in
 * `infrastructure/repositories/mappers/mapMcpConnector.ts` translate at the
 * boundary. UI code only sees the camelCase shapes here.
 */

import {
  MCP_OAUTH_CALLBACK_PORT_KEY,
  MCP_OAUTH_CLIENT_ID_KEY,
  MCP_OAUTH_CONFIG_KEY,
  MCP_OAUTH_LOGIN_URL_KEY,
  MCP_OAUTH_OMIT_RESOURCE_KEY,
  MAX_TCP_PORT,
  MIN_TCP_PORT,
} from '@/constants/mcpOAuth';

/** Transport discriminator on an `McpConnector`. `http` = HTTP-SSE;
 *  `streamable_http` = the modern remote transport used by OAuth-era servers;
 *  `stdio` = a CLIENT-DELEGATED local server (runs on this desktop; the backend
 *  delegates tool calls to us — Phase F). */
export type McpTransport = 'http' | 'streamable_http' | 'stdio';

/** How to launch a local (stdio) MCP server. Lives ONLY on the desktop (OS
 *  keychain), never sent to the backend. Mirrors Claude Desktop's `mcpServers`
 *  entry shape. `env` carries credentials (e.g. `GITHUB_TOKEN`) — secret. */
export interface StdioServerConfig {
  command: string;
  args: string[];
  /** Environment variables for the subprocess (carries credentials; secret). */
  env: Record<string, string>;
}

/** The editor's whole-config shape: a map of display name → launch config,
 *  matching Claude Desktop's `claude_desktop_config.json` `mcpServers` block. */
export interface LocalServersConfig {
  mcpServers: Record<string, StdioServerConfig>;
}

/** One tool schema discovered locally (Rust `mcp_stdio_discover`) and pushed up
 *  to the backend's `/client-delegated` route. */
export interface ClientToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Body for `POST /api/mcp-connectors/client-delegated` (camelCase; the mapper
 *  converts to the BE's snake_case `{display_name, transport, tools:[{name,
 *  description, input_schema}]}`). */
export interface RegisterClientDelegatedPayload {
  displayName: string;
  description?: string;
  tools: ClientToolSchema[];
}

/** Lifecycle status — mirrors the BE `mcp_connectors.status` column.
 *  `active` = usable; `inactive` = parked (hidden from runtime); `archived` =
 *  soft-deleted. */
export type McpConnectorStatus = 'active' | 'inactive' | 'archived';

/** Auth strategy discriminator — one of the BE `SUPPORTED_AUTH_TYPES`.
 *  Drives the registration form; the stored credentials are a generic
 *  injection list regardless (except `oauth`, which has no static creds). */
export type McpAuthType = 'none' | 'bearer' | 'api_key' | 'headers' | 'oauth';

/** Where a single credential value is injected on each upstream request. */
export type InjectionLocation = 'header' | 'query_param';

/** One credential injection — the BE stores `credentials` as a list of these,
 *  encrypted at rest. */
export interface CredentialInjection {
  location: InjectionLocation;
  name: string;
  value: string;
}

/** The canonical credentials shape sent to / understood by the BE. */
export interface ConnectorCredentials {
  injections: CredentialInjection[];
}

/** Per-connector tool count summary returned by `GET /api/mcp-connectors`. */
export interface McpConnectorToolCounts {
  total: number;
  enabled: number;
}

/** One row from `/api/mcp-connectors` (or the create / update response). */
export interface McpConnector {
  /** UUID of the mcp_connectors record. */
  id: string;
  /** User-facing label (unique per user among non-archived rows). */
  displayName: string;
  /** Optional prose describing the connector. */
  description: string | null;
  /** Transport discriminator. */
  transport: McpTransport;
  /**
   * Transport-specific shape (both remote transports key off `url`):
   *  - `{ url: string }`
   *
   * Kept as `Record<string, unknown>` here so we don't discriminate at the
   * type level in every consumer.
   */
  config: Record<string, unknown>;
  /** Auth strategy discriminator. */
  authType: McpAuthType;
  /** True when encrypted credentials are stored on the BE.
   *  The ciphertext itself is NEVER returned by the BE. */
  hasCredentials: boolean;
  /** True once the OAuth connect flow has stored tokens (the "connected"
   *  signal). Only meaningful for `authType === 'oauth'`. The tokens
   *  themselves are never returned. */
  hasOauthTokens: boolean;
  /** Lifecycle status. */
  status: McpConnectorStatus;
  /** Populated on `list` responses; may be `null` on create / update
   *  responses where the BE didn't compute it. */
  tools: McpConnectorToolCounts | null;
  /** ISO-8601 timestamps from the BE. */
  createdAt: string;
  modifiedAt: string;
}

/** The 201 response from `POST /api/mcp-connectors` extends `McpConnector`
 *  with the list of api_names discovered at registration time. */
export interface RegisteredMcpConnector extends McpConnector {
  discoveredToolApiNames: string[];
}

/** Body for `POST /api/mcp-connectors`. */
export interface CreateMcpConnectorPayload {
  displayName: string;
  description?: string;
  transport: McpTransport;
  /** Transport-specific shape — see `McpConnector.config`. */
  config: Record<string, unknown>;
  authType: McpAuthType;
  /** Optional injection-list credentials (encrypted at rest by the BE).
   *  Omitted for `none` / `oauth`. */
  credentials?: ConnectorCredentials;
}

/** Body for `PATCH /api/mcp-connectors/{id}`. Every field optional;
 *  set `clearCredentials: true` to wipe stored credentials regardless
 *  of `credentials`. */
export interface UpdateMcpConnectorPayload {
  displayName?: string;
  description?: string;
  authType?: McpAuthType;
  status?: McpConnectorStatus;
  credentials?: ConnectorCredentials;
  clearCredentials?: boolean;
}

/** Response from `POST /api/mcp-connectors/{id}/refresh-tools`. */
export interface RefreshToolsResult {
  added: number;
  unchanged: number;
  archived: number;
}

/** Body for `POST /api/mcp-connectors/{id}/oauth-authorization`. Both fields
 *  are only used on the manual-client fallback (an authorization server with
 *  no dynamic client registration). */
export interface StartOAuthPayload {
  clientId?: string;
  clientSecret?: string;
}

/** Response from `POST /api/mcp-connectors/{id}/oauth-authorization`. Exactly
 *  one state is meaningful: an `authorizationUrl` to open in the browser, or
 *  `requiresManualClient=true` (collect a client_id and re-call). */
export interface StartOAuthResult {
  authorizationUrl: string | null;
  requiresManualClient: boolean;
}

/**
 * Generic pre-registered OAuth app config (tracker #130). Carried under
 * `connector.config.oauth` for servers whose authorization server uses a
 * pre-registered client + a fixed RFC 8252 loopback redirect rather than
 * Dynamic Client Registration + the global server-side callback. Stored as
 * opaque camelCase JSON on `config` (no mapper translation). Product-agnostic:
 * the loopback path keys off the presence of `callbackPort`, never a server
 * name.
 */
export interface McpOAuthConfig {
  /** The pre-registered OAuth client id (used directly; DCR is skipped). */
  clientId: string;
  /** The authorization-server discovery base (per-org login URL). */
  loginUrl: string;
  /** Loopback port the AS redirects to (`http://localhost:{port}/callback`). */
  callbackPort: number;
  /** When true, the backend omits the RFC 8707 `resource` param from the token
   *  exchange request (tracker #136). Required for Salesforce — its token
   *  endpoint rejects that param with `invalid_grant`. */
  omitResourceAtTokenExchange?: boolean;
}

/** Body for `POST /api/mcp-connectors/{id}/oauth-completion` — the code + state
 *  the desktop loopback listener captured from the AS redirect. */
export interface CompleteOAuthRequest {
  code: string;
  state: string;
}

/** Response from `POST /api/mcp-connectors/{id}/oauth-completion`. */
export interface CompleteOAuthResult {
  /** The connector that was successfully connected. */
  connectorId: string;
}

/**
 * Read the optional pre-registered OAuth block off a connector's opaque
 * `config`. Returns the typed block only when it is fully specified and valid —
 * a non-empty `clientId` + `loginUrl` and an integer `callbackPort` in
 * `(0, 65536)`; otherwise `null` (a plain DCR oauth connector, or no block).
 *
 * Pure (no I/O). The single place that interprets the `config.oauth` shape, so
 * the loopback-vs-browser decision is made from one validated reader.
 */
export function readMcpOAuthConfig(
  config: Record<string, unknown>,
): McpOAuthConfig | null {
  const raw = config[MCP_OAUTH_CONFIG_KEY];
  if (typeof raw !== 'object' || raw === null) return null;
  const block = raw as Record<string, unknown>;

  const clientId = block[MCP_OAUTH_CLIENT_ID_KEY];
  const loginUrl = block[MCP_OAUTH_LOGIN_URL_KEY];
  const callbackPort = block[MCP_OAUTH_CALLBACK_PORT_KEY];

  if (typeof clientId !== 'string' || clientId.trim() === '') return null;
  if (typeof loginUrl !== 'string' || loginUrl.trim() === '') return null;
  if (
    typeof callbackPort !== 'number' ||
    !Number.isInteger(callbackPort) ||
    callbackPort <= MIN_TCP_PORT ||
    callbackPort >= MAX_TCP_PORT
  ) {
    return null;
  }

  const omit = block[MCP_OAUTH_OMIT_RESOURCE_KEY];
  return {
    clientId,
    loginUrl,
    callbackPort,
    ...(omit === true ? { omitResourceAtTokenExchange: true } : {}),
  };
}
