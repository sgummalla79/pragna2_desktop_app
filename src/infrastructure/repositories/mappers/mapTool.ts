/**
 * Mapper for the `/api/tools` response shape (snake_case) → domain `Tool`.
 */

import type { Tool, ToolType } from '@/domain/types/tool.types';

export interface ApiToolResponse {
  id: string;
  user_id: string | null;
  mcp_connector_id: string | null;
  api_name: string;
  display_name: string;
  description: string;
  tool_type: ToolType;
  handler_family: string | null;
  system_managed: boolean;
  auto_bind_to_default_agent: boolean;
  enabled: boolean;
  created_at: string;
  modified_at: string;
}

export function mapTool(raw: ApiToolResponse): Tool {
  return {
    id: raw.id,
    userId: raw.user_id,
    mcpConnectorId: raw.mcp_connector_id,
    apiName: raw.api_name,
    displayName: raw.display_name,
    description: raw.description,
    toolType: raw.tool_type,
    handlerFamily: raw.handler_family,
    systemManaged: raw.system_managed,
    autoBindToDefaultAgent: raw.auto_bind_to_default_agent,
    enabled: raw.enabled,
    createdAt: raw.created_at,
    modifiedAt: raw.modified_at,
  };
}
