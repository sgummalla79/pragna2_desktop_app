import { createContext, useContext } from 'react';
import type { AuthService } from '@/application/services/AuthService';
import type { LlmProviderService } from '@/application/services/LlmProviderService';
import type { ProviderService } from '@/application/services/ProviderService';
import type { ModelService } from '@/application/services/ModelService';
import type { EmbeddingKeyService } from '@/application/services/EmbeddingKeyService';
import type { McpConnectorService } from '@/application/services/McpConnectorService';
import type { ToolService } from '@/application/services/ToolService';
import type { KnowledgeService } from '@/application/services/KnowledgeService';
import type { AgentService } from '@/application/services/AgentService';
import type { ConversationService } from '@/application/services/ConversationService';
import type { FlowService } from '@/application/services/FlowService';
import type { PragnaFlowService } from '@/application/services/PragnaFlowService';
import type { EpisodeService } from '@/application/services/EpisodeService';
import type { AttachmentService } from '@/application/services/AttachmentService';

/**
 * Dependency-injection container for application services.
 *
 * Add a service here as each feature lands (open/closed) — call sites read only
 * the services they need via {@link useServices}.
 */
export interface Services {
  authService: AuthService;
  /** Global LLM provider catalogue (GET /api/llm-providers[/with-registrations]). */
  llmProviderService: LlmProviderService;
  /** The user's registered providers (/api/user-providers). */
  providerService: ProviderService;
  /** The user's models (/api/user-models). */
  modelService: ModelService;
  /** The user's per-user embedding (Voyage) key (/api/auth/me/embedding-key). */
  embeddingKeyService: EmbeddingKeyService;
  /** The user's MCP connectors (/api/mcp-connectors). */
  mcpConnectorService: McpConnectorService;
  /** The user's tools inventory (/api/tools). */
  toolService: ToolService;
  /** The user's knowledge libraries (/api/knowledge-libraries). */
  knowledgeService: KnowledgeService;
  /** The user's standalone agents (/api/agents). */
  agentService: AgentService;
  /** The user's chat conversations + messages (/api/conversations). */
  conversationService: ConversationService;
  /** The user's agent flows (/api/flows). */
  flowService: FlowService;
  /** Chat slash-command discovery for the composer (/api/pragna/flows). */
  pragnaFlowService: PragnaFlowService;
  /** HITL episode reads (/api/conversations/{id}/episodes). */
  episodeService: EpisodeService;
  /** Chat attachments — upload + content fetch (/api/conversations/{id}/attachments). */
  attachmentService: AttachmentService;
}

export const ServiceContext = createContext<Services | null>(null);

export function useServices(): Services {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error('useServices must be used inside ServiceProvider');
  return ctx;
}
