/**
 * Domain types for agent ↔ MCP-connector attachments
 * (`/api/agents/{id}/connectors`).
 *
 * A standalone agent attaches one or more MCP connectors; each attachment is a
 * binding row carrying an optional per-tool selection. The connector's identity
 * (display name etc.) is NOT on the binding — the UI joins against the
 * connectors list (`useMcpConnectors`) by `mcpConnectorId`.
 *
 * The BE serialises in snake_case; the mapper in
 * `infrastructure/repositories/mappers/mapAgentConnector.ts` translates at the
 * boundary. UI code only sees the camelCase shapes here.
 */

/** One agent↔connector binding row from `GET /api/agents/{id}/connectors`. */
export interface AgentConnector {
  /** UUID of the binding row (used for PATCH / DELETE). */
  id: string;
  /** The attached connector's id (FK → mcp_connectors). */
  mcpConnectorId: string;
  /** Per-tool selection (tool api_names). `null` / empty = all of the
   *  connector's enabled tools. */
  selectedTools: string[] | null;
  /** ISO-8601 timestamps from the BE. */
  createdAt: string;
  modifiedAt: string;
}

/** Body for `POST /api/agents/{id}/connectors`. */
export interface AttachAgentConnectorPayload {
  mcpConnectorId: string;
  /** Per-tool selection; omit / null = all enabled tools. */
  selectedTools?: string[] | null;
}

/** Body for `PATCH /api/agents/{id}/connectors/{bindingId}`. */
export interface UpdateAgentConnectorPayload {
  /** New per-tool selection; null / empty = all enabled tools. */
  selectedTools: string[] | null;
}
