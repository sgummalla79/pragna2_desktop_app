import { useMemo, type ReactNode } from 'react';
import { axiosClient } from '@/infrastructure/http/axiosClient';
import { applyAuthInterceptor } from '@/infrastructure/http/authInterceptor';
import { applyCorrelationInterceptor } from '@/infrastructure/http/correlationInterceptor';
import { applyVersionInterceptor } from '@/infrastructure/http/versionInterceptor';
import { Auth0Repository } from '@/infrastructure/auth0/Auth0Repository';
import { TauriLoopbackAuthFlow } from '@/infrastructure/auth0/tauriLoopbackAuthFlow';
import { LlmProviderRepository } from '@/infrastructure/repositories/LlmProviderRepository';
import { ProviderRepository } from '@/infrastructure/repositories/ProviderRepository';
import { ModelRepository } from '@/infrastructure/repositories/ModelRepository';
import { EmbeddingKeyRepository } from '@/infrastructure/repositories/EmbeddingKeyRepository';
import { KnowledgeSettingsRepository } from '@/infrastructure/repositories/KnowledgeSettingsRepository';
import { McpConnectorRepository } from '@/infrastructure/repositories/McpConnectorRepository';
import { TauriMcpOAuthLoopbackFlow } from '@/infrastructure/mcp/tauriMcpOAuthLoopbackFlow';
import { ToolRepository } from '@/infrastructure/repositories/ToolRepository';
import { KnowledgeRepository } from '@/infrastructure/repositories/KnowledgeRepository';
import { AgentRepository } from '@/infrastructure/repositories/AgentRepository';
import { AgentTemplateRepository } from '@/infrastructure/repositories/AgentTemplateRepository';
import { ConversationRepository } from '@/infrastructure/repositories/ConversationRepository';
import { FlowRepository } from '@/infrastructure/repositories/FlowRepository';
import { PragnaFlowRepository } from '@/infrastructure/repositories/PragnaFlowRepository';
import { EpisodeRepository } from '@/infrastructure/repositories/EpisodeRepository';
import { AttachmentRepository } from '@/infrastructure/repositories/AttachmentRepository';
import { AuthService } from '@/application/services/AuthService';
import { LlmProviderService } from '@/application/services/LlmProviderService';
import { ProviderService } from '@/application/services/ProviderService';
import { ModelService } from '@/application/services/ModelService';
import { EmbeddingKeyService } from '@/application/services/EmbeddingKeyService';
import { KnowledgeSettingsService } from '@/application/services/KnowledgeSettingsService';
import { McpConnectorService } from '@/application/services/McpConnectorService';
import { ToolService } from '@/application/services/ToolService';
import { KnowledgeService } from '@/application/services/KnowledgeService';
import { AgentService } from '@/application/services/AgentService';
import { AgentTemplateService } from '@/application/services/AgentTemplateService';
import { ConversationService } from '@/application/services/ConversationService';
import { FlowService } from '@/application/services/FlowService';
import { PragnaFlowService } from '@/application/services/PragnaFlowService';
import { EpisodeService } from '@/application/services/EpisodeService';
import { AttachmentService } from '@/application/services/AttachmentService';
import { useAuthStore } from '@/presentation/store/authStore';
import { ServiceContext } from './ServiceContext';

applyCorrelationInterceptor(axiosClient);
applyVersionInterceptor(axiosClient);

interface ServiceProviderProps {
  children: ReactNode;
}

/**
 * Constructs the application services once and provides them via context.
 * Wires the Auth0 strategy (email/password ROPG + social redirect) onto the
 * shared axios client. On a 401 the auth interceptor resets the auth store.
 */
export function ServiceProvider({ children }: ServiceProviderProps) {
  const reset = useAuthStore((s) => s.reset);

  const services = useMemo(() => {
    applyAuthInterceptor(axiosClient, reset);

    const authFlow = new TauriLoopbackAuthFlow();
    const authRepo = new Auth0Repository(axiosClient, authFlow);

    return {
      authService: new AuthService(authRepo),
      llmProviderService: new LlmProviderService(new LlmProviderRepository(axiosClient)),
      providerService: new ProviderService(new ProviderRepository(axiosClient)),
      modelService: new ModelService(new ModelRepository(axiosClient)),
      embeddingKeyService: new EmbeddingKeyService(new EmbeddingKeyRepository(axiosClient)),
      knowledgeSettingsService: new KnowledgeSettingsService(
        new KnowledgeSettingsRepository(axiosClient),
      ),
      mcpConnectorService: new McpConnectorService(
        new McpConnectorRepository(axiosClient),
        new TauriMcpOAuthLoopbackFlow(),
      ),
      toolService: new ToolService(new ToolRepository(axiosClient)),
      knowledgeService: new KnowledgeService(new KnowledgeRepository(axiosClient)),
      agentService: new AgentService(new AgentRepository(axiosClient)),
      agentTemplateService: new AgentTemplateService(
        new AgentTemplateRepository(axiosClient),
      ),
      conversationService: new ConversationService(
        new ConversationRepository(axiosClient),
      ),
      flowService: new FlowService(new FlowRepository(axiosClient)),
      pragnaFlowService: new PragnaFlowService(new PragnaFlowRepository(axiosClient)),
      episodeService: new EpisodeService(new EpisodeRepository(axiosClient)),
      attachmentService: new AttachmentService(new AttachmentRepository(axiosClient)),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>;
}
