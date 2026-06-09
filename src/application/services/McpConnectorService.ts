import type { IMcpConnectorRepository } from '@/application/ports/IMcpConnectorRepository';
import type {
  CreateMcpConnectorPayload,
  McpConnector,
  RefreshToolsResult,
  RegisteredMcpConnector,
  StartOAuthPayload,
  StartOAuthResult,
  UpdateMcpConnectorPayload,
} from '@/domain/types/mcp.types';

/**
 * Manages the user's registered MCP connectors via the
 * `/api/mcp-connectors/*` endpoints. Thin facade over the repository —
 * exists for consistency with the rest of the service layer and to give
 * consumers a single injection point.
 */
export class McpConnectorService {
  constructor(private readonly repo: IMcpConnectorRepository) {}

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
}
