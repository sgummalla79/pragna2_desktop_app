/**
 * Port for the MCP-connector repository.
 *
 * Application layer depends on this interface; concrete implementation
 * (axios-backed) lives in
 * `src/infrastructure/repositories/McpConnectorRepository.ts`.
 */

import type {
  ClientToolSchema,
  CompleteOAuthRequest,
  CompleteOAuthResult,
  CreateMcpConnectorPayload,
  McpConnector,
  RefreshToolsResult,
  RegisterClientDelegatedPayload,
  RegisteredMcpConnector,
  StartOAuthPayload,
  StartOAuthResult,
  UpdateMcpConnectorPayload,
} from '@/domain/types/mcp.types';

export interface IMcpConnectorRepository {
  /** List the user's active (non-archived) connectors with per-connector
   *  tool counts. Maps to `GET /api/mcp-connectors`. */
  list(): Promise<McpConnector[]>;

  /** Register a new connector. BE runs upstream discovery and persists one
   *  `mcp_connector_tools` row per upstream tool (`enabled=true`, opt-out).
   *  The returned object includes the discovered api_names so the UI can
   *  show a meaningful count. Maps to `POST /api/mcp-connectors`. */
  register(payload: CreateMcpConnectorPayload): Promise<RegisteredMcpConnector>;

  /** Register a CLIENT-DELEGATED (stdio) connector — no server-side discovery;
   *  the desktop supplies the locally-discovered tool schemas. Stores identity
   *  + schemas only (no url / credentials). Maps to
   *  `POST /api/mcp-connectors/client-delegated`. */
  registerClientDelegated(
    payload: RegisterClientDelegatedPayload,
  ): Promise<RegisteredMcpConnector>;

  /** Re-sync a client-delegated connector's tools from a fresh desktop schema
   *  list (reconciles added/unchanged/archived). Maps to
   *  `POST /api/mcp-connectors/{id}/sync-tools`. */
  syncTools(id: string, tools: ClientToolSchema[]): Promise<RefreshToolsResult>;

  /** Partial update — display_name / description / auth_type / status /
   *  credentials. Maps to `PATCH /api/mcp-connectors/{id}`. */
  update(id: string, payload: UpdateMcpConnectorPayload): Promise<McpConnector>;

  /** Soft-delete (`status='archived'`): cascades `enabled=false` to the
   *  connector's tools. Maps to `DELETE /api/mcp-connectors/{id}` (204). */
  archive(id: string): Promise<void>;

  /** Re-run upstream discovery and reconcile local tool rows. Existing user
   *  opt-ins are preserved on the BE side. Maps to
   *  `POST /api/mcp-connectors/{id}/refresh-tools`. */
  refreshTools(id: string): Promise<RefreshToolsResult>;

  /** Begin the OAuth 2.1 connect flow for an `auth_type='oauth'` connector.
   *  Returns an `authorizationUrl` to open in the system browser, or
   *  `requiresManualClient` when the AS lacks dynamic client registration.
   *  Maps to `POST /api/mcp-connectors/{id}/oauth-authorization`. */
  startOAuth(id: string, payload: StartOAuthPayload): Promise<StartOAuthResult>;

  /** Finish a loopback (pre-registered `callbackPort`) OAuth flow by handing
   *  the captured `code` + `state` to the BE for the token exchange. Maps to
   *  `POST /api/mcp-connectors/{id}/oauth-completion`. */
  completeOAuth(
    id: string,
    payload: CompleteOAuthRequest,
  ): Promise<CompleteOAuthResult>;

  /** Clear all stored OAuth tokens and any in-flight handshake state, leaving
   *  the connector config intact and ready for a fresh consent flow. Maps to
   *  `DELETE /api/mcp-connectors/{id}/oauth-tokens` (204). */
  disconnectOAuth(id: string): Promise<void>;
}
