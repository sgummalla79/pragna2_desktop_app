import type { IMcpConnectorRepository } from '@/application/ports/IMcpConnectorRepository';
import type { IMcpOAuthLoopbackFlow } from '@/application/ports/IMcpOAuthLoopbackFlow';
import type {
  ClientToolSchema,
  CreateMcpConnectorPayload,
  McpConnector,
  RefreshToolsResult,
  RegisterClientDelegatedPayload,
  RegisteredMcpConnector,
  StartOAuthPayload,
  StartOAuthResult,
  UpdateMcpConnectorPayload,
} from '@/domain/types/mcp.types';

/**
 * Result of {@link McpConnectorService.connectViaLoopback}. Either the connect
 * completed (`connected`) or the BE asked for a manual client (`requires_manual_client`)
 * — the caller then routes to the existing manual-client form (not expected for a
 * correctly-configured pre-registered connector, whose `clientId` lives in
 * `config.oauth`).
 */
export type ConnectViaLoopbackResult =
  | { status: 'connected'; connectorId: string }
  | { status: 'requires_manual_client' };

/**
 * Manages the user's registered MCP connectors via the
 * `/api/mcp-connectors/*` endpoints. Thin facade over the repository —
 * exists for consistency with the rest of the service layer and to give
 * consumers a single injection point.
 */
export class McpConnectorService {
  constructor(
    private readonly repo: IMcpConnectorRepository,
    private readonly oauthLoopbackFlow: IMcpOAuthLoopbackFlow,
  ) {}

  /** List the user's active connectors with per-connector tool counts. */
  list(): Promise<McpConnector[]> {
    return this.repo.list();
  }

  /**
   * Register a new connector. The BE runs upstream discovery and persists
   * one `mcp_connector_tools` row per upstream tool (`enabled=true`). The
   * returned `RegisteredMcpConnector` includes the discovered api_names so
   * the UI can surface a meaningful "discovered N tools" message.
   */
  register(payload: CreateMcpConnectorPayload): Promise<RegisteredMcpConnector> {
    return this.repo.register(payload);
  }

  /** Register a CLIENT-DELEGATED (stdio) connector from desktop-discovered tool
   *  schemas (no server-side discovery). */
  registerClientDelegated(
    payload: RegisterClientDelegatedPayload,
  ): Promise<RegisteredMcpConnector> {
    return this.repo.registerClientDelegated(payload);
  }

  /** Re-sync a client-delegated connector's tools from a fresh desktop list. */
  syncTools(id: string, tools: ClientToolSchema[]): Promise<RefreshToolsResult> {
    return this.repo.syncTools(id, tools);
  }

  /** Partial update — display_name / description / auth_type / status /
   *  credentials. */
  update(id: string, payload: UpdateMcpConnectorPayload): Promise<McpConnector> {
    return this.repo.update(id, payload);
  }

  /** Soft-delete + cascade-disable tools. */
  archive(id: string): Promise<void> {
    return this.repo.archive(id);
  }

  /** Re-run upstream discovery; existing user opt-ins are preserved. */
  refreshTools(id: string): Promise<RefreshToolsResult> {
    return this.repo.refreshTools(id);
  }

  /** Begin the OAuth 2.1 connect flow (returns the auth URL or the
   *  manual-client signal). */
  startOAuth(id: string, payload: StartOAuthPayload): Promise<StartOAuthResult> {
    return this.repo.startOAuth(id, payload);
  }

  /**
   * Clear all stored OAuth tokens and any in-flight handshake state for the
   * connector, leaving its config intact so the user can reconnect via a fresh
   * consent flow. After this call `hasOauthTokens` will be `false` on the
   * connector.
   *
   * @param id The connector whose tokens to clear.
   * @throws Propagates repository errors for the caller to surface inline.
   */
  disconnectOAuth(id: string): Promise<void> {
    return this.repo.disconnectOAuth(id);
  }

  /**
   * Complete a pre-registered-client (loopback) OAuth connect on the desktop
   * (tracker #131): authorize → capture the redirect on the connector's fixed
   * `callbackPort` → exchange. Used only when the connector carries
   * `config.oauth.callbackPort` and the desktop runtime is available; otherwise
   * the caller uses the browser-redirect {@link startOAuth} path.
   *
   * The `startOAuth` payload is empty by design — the pre-registered `clientId`
   * already lives in `config.oauth` and is applied by the backend before it
   * builds the authorization URL.
   *
   * @param id The connector to connect.
   * @param callbackPort The connector's `config.oauth.callbackPort`.
   * @returns `connected` (with the connector id) or the `requires_manual_client`
   *   signal.
   * @throws Propagates repository errors (`startOAuth` / `completeOAuth`) and
   *   loopback-capture errors (port-in-use, timeout, provider error) for the
   *   caller to surface inline.
   */
  async connectViaLoopback(
    id: string,
    callbackPort: number,
  ): Promise<ConnectViaLoopbackResult> {
    const { authorizationUrl, requiresManualClient } = await this.repo.startOAuth(
      id,
      {},
    );
    if (requiresManualClient) {
      return { status: 'requires_manual_client' };
    }
    if (!authorizationUrl) {
      throw new Error('OAuth authorization did not return an authorization URL.');
    }
    const { code, state } = await this.oauthLoopbackFlow.capture(
      callbackPort,
      authorizationUrl,
    );
    const { connectorId } = await this.repo.completeOAuth(id, { code, state });
    return { status: 'connected', connectorId };
  }
}
