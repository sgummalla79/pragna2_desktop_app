/**
 * Mappers for the `/api/agents` response shapes.
 *
 * Translate the BE snake_case envelopes (`AgentResponse` +
 * `DefaultAgentTemplateResponse`) into the camelCase domain shapes.
 */

import type {
  Agent,
  AgentStatus,
  DefaultAgentTemplate,
} from '@/domain/types/agent.types';

/** Raw `/api/agents` row as serialised by the BE. */
export interface ApiAgentResponse {
  id: string;
  api_name: string;
  display_name: string;
  description: string | null;
  system_prompt: string;
  tools: string[];
  is_default: boolean;
  status: AgentStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  modified_at: string;
}

/** Raw `/api/agents/default-template` payload as serialised by the BE. */
export interface ApiDefaultAgentTemplateResponse {
  api_name: string;
  display_name: string;
  description: string;
  system_prompt: string;
  tools: string[];
}

/** Maps a raw agent row to the domain `Agent` shape. */
export function mapAgent(raw: ApiAgentResponse): Agent {
  return {
    id: raw.id,
    apiName: raw.api_name,
    displayName: raw.display_name,
    description: raw.description,
    systemPrompt: raw.system_prompt,
    tools: raw.tools ?? [],
    isDefault: raw.is_default,
    status: raw.status,
    metadata: raw.metadata ?? {},
    createdAt: raw.created_at,
    modifiedAt: raw.modified_at,
  };
}

/** Maps the raw default-template payload to the domain shape. */
export function mapDefaultAgentTemplate(
  raw: ApiDefaultAgentTemplateResponse,
): DefaultAgentTemplate {
  return {
    apiName: raw.api_name,
    displayName: raw.display_name,
    description: raw.description,
    systemPrompt: raw.system_prompt,
    tools: raw.tools ?? [],
  };
}
