/**
 * Mappers for the MCP-connector BE shape (snake_case) ↔ domain shape
 * (camelCase).
 *
 * The BE responses carry the fields as declared by Pydantic — snake_case
 * under FastAPI's default JSON serialiser. We translate at this boundary so
 * UI code only sees the camelCase domain types.
 */

import type {
  ClientToolSchema,
  CreateMcpConnectorPayload,
  McpAuthType,
  McpConnector,
  McpConnectorStatus,
  McpConnectorToolCounts,
  McpTransport,
  RegisterClientDelegatedPayload,
  RegisteredMcpConnector,
  UpdateMcpConnectorPayload,
} from '@/domain/types/mcp.types';

/** Raw shape returned by `GET /api/mcp-connectors` + `PATCH` + nested inside
 *  `POST` responses. */
export interface ApiMcpConnectorResponse {
  id: string;
  display_name: string;
  description: string | null;
  transport: McpTransport;
  config: Record<string, unknown>;
  auth_type: McpAuthType;
  has_credentials: boolean;
  has_oauth_tokens?: boolean;
  status: McpConnectorStatus;
  tools: ApiMcpConnectorToolCounts | null;
  created_at: string;
  modified_at: string;
}

export interface ApiMcpConnectorToolCounts {
  total: number;
  enabled: number;
}

/** Extends the base connector response with discovered tool api_names —
 *  the 201 shape from `POST /api/mcp-connectors`. */
export interface ApiRegisteredMcpConnectorResponse
  extends ApiMcpConnectorResponse {
  discovered_tool_api_names: string[];
}

/** Raw shape returned by `POST /api/mcp-connectors/{id}/refresh-tools`. */
export interface ApiRefreshToolsResponse {
  added: number;
  unchanged: number;
  archived: number;
}

/** Map an API tool-counts object to the domain shape. */
function mapToolCounts(
  raw: ApiMcpConnectorToolCounts | null,
): McpConnectorToolCounts | null {
  if (raw === null) return null;
  return {
    total: raw.total,
    enabled: raw.enabled,
  };
}

/** Map an API connector response to a domain entity. */
export function mapMcpConnector(raw: ApiMcpConnectorResponse): McpConnector {
  return {
    id: raw.id,
    displayName: raw.display_name,
    description: raw.description ?? null,
    transport: raw.transport,
    config: raw.config ?? {},
    authType: raw.auth_type,
    hasCredentials: raw.has_credentials,
    hasOauthTokens: raw.has_oauth_tokens ?? false,
    status: raw.status,
    tools: mapToolCounts(raw.tools),
    createdAt: raw.created_at,
    modifiedAt: raw.modified_at,
  };
}

/** Map the 201 `POST` response to a `RegisteredMcpConnector`. */
export function mapRegisteredMcpConnector(
  raw: ApiRegisteredMcpConnectorResponse,
): RegisteredMcpConnector {
  return {
    ...mapMcpConnector(raw),
    discoveredToolApiNames: raw.discovered_tool_api_names ?? [],
  };
}

/** Map the domain create payload to the snake_case shape the BE expects. */
export function toApiCreatePayload(
  payload: CreateMcpConnectorPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    display_name: payload.displayName,
    transport: payload.transport,
    config: payload.config,
    auth_type: payload.authType,
  };
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.credentials !== undefined) body.credentials = payload.credentials;
  return body;
}

/** Map client-supplied tool schemas to the BE's snake_case `input_schema` shape. */
function toApiToolSchemas(tools: ClientToolSchema[]): Record<string, unknown>[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

/** Map a client-delegated (stdio) registration payload to the BE shape for
 *  `POST /api/mcp-connectors/client-delegated`. No url / credentials — the
 *  launch config lives on the desktop. */
export function toApiClientDelegatedPayload(
  payload: RegisterClientDelegatedPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    display_name: payload.displayName,
    transport: 'stdio',
    tools: toApiToolSchemas(payload.tools),
  };
  if (payload.description !== undefined) body.description = payload.description;
  return body;
}

/** Map a re-sync tool list to the BE shape for
 *  `POST /api/mcp-connectors/{id}/sync-tools`. */
export function toApiSyncToolsPayload(
  tools: ClientToolSchema[],
): Record<string, unknown> {
  return { tools: toApiToolSchemas(tools) };
}

/** Map the domain update payload to the snake_case shape the BE expects.
 *  Only sends the keys the caller actually set, so the BE leaves unset fields
 *  unchanged. */
export function toApiUpdatePayload(
  payload: UpdateMcpConnectorPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (payload.displayName !== undefined) body.display_name = payload.displayName;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.authType !== undefined) body.auth_type = payload.authType;
  if (payload.status !== undefined) body.status = payload.status;
  if (payload.credentials !== undefined) body.credentials = payload.credentials;
  if (payload.clearCredentials !== undefined) {
    body.clear_credentials = payload.clearCredentials;
  }
  return body;
}
