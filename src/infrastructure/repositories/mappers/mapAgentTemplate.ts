/**
 * Mappers for the `/api/agents/templates` response shapes.
 *
 * Translate the BE snake_case envelopes (`AgentTemplateResponse` +
 * `ActivateAgentTemplateResponse`) into the camelCase domain shapes. The
 * activate response is an `AgentResponse` widened with activation metadata, so
 * its agent part is mapped by reusing {@link mapAgent}.
 */

import type {
  ActivatedAgentTemplate,
  AgentTemplate,
} from '@/domain/types/agentTemplate.types';
import { type ApiAgentResponse, mapAgent } from './mapAgent';

/** Raw `/api/agents/templates` row as serialised by the BE. */
export interface ApiAgentTemplateResponse {
  key: string;
  api_name: string;
  display_name: string;
  description: string;
  system_prompt: string;
  tools: string[];
  activatable: boolean;
}

/**
 * Raw `/api/agents/templates/{key}/activate` payload. The full agent row
 * (same fields as {@link ApiAgentResponse}) plus activation metadata.
 */
export interface ApiActivateAgentTemplateResponse extends ApiAgentResponse {
  created: boolean;
  knowledge_seeded: boolean;
  knowledge_note: string | null;
}

/** Maps a raw template row to the domain {@link AgentTemplate} shape. */
export function mapAgentTemplate(raw: ApiAgentTemplateResponse): AgentTemplate {
  return {
    key: raw.key,
    apiName: raw.api_name,
    displayName: raw.display_name,
    description: raw.description,
    systemPrompt: raw.system_prompt,
    tools: raw.tools ?? [],
    activatable: raw.activatable,
  };
}

/** Maps the raw activate payload to the domain {@link ActivatedAgentTemplate}. */
export function mapActivatedAgentTemplate(
  raw: ApiActivateAgentTemplateResponse,
): ActivatedAgentTemplate {
  return {
    agent: mapAgent(raw),
    created: raw.created,
    knowledgeSeeded: raw.knowledge_seeded,
    knowledgeNote: raw.knowledge_note,
  };
}
