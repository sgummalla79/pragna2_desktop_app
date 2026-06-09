/**
 * Mapper for the agent↔connector binding response shape.
 *
 * Translates the BE snake_case `AgentConnectorResponse` into the camelCase
 * domain shape.
 */

import type { AgentConnector } from '@/domain/types/agentConnector.types';

/** Raw `/api/agents/{id}/connectors` binding row as serialised by the BE. */
export interface ApiAgentConnectorResponse {
  id: string;
  mcp_connector_id: string;
  selected_tools: string[] | null;
  created_at: string;
  modified_at: string;
}

/** Maps a raw binding row to the domain `AgentConnector` shape. */
export function mapAgentConnector(
  raw: ApiAgentConnectorResponse,
): AgentConnector {
  return {
    id: raw.id,
    mcpConnectorId: raw.mcp_connector_id,
    selectedTools: raw.selected_tools,
    createdAt: raw.created_at,
    modifiedAt: raw.modified_at,
  };
}
