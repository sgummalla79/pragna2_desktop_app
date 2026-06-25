import type { IAgentTemplateRepository } from '@/application/ports/IAgentTemplateRepository';
import type {
  ActivatedAgentTemplate,
  AgentTemplate,
} from '@/domain/types/agentTemplate.types';

/**
 * Browses + activates the BE-owned system agent templates via the
 * `/api/agents/templates/*` endpoints. Thin facade over the repository.
 */
export class AgentTemplateService {
  constructor(private readonly repo: IAgentTemplateRepository) {}

  /** Lists the available system agent templates. */
  list(): Promise<AgentTemplate[]> {
    return this.repo.list();
  }

  /** Reads one template by its system key. */
  get(key: string): Promise<AgentTemplate> {
    return this.repo.get(key);
  }

  /** Activates a template (idempotent) — copies it into the user's agents. */
  activate(key: string): Promise<ActivatedAgentTemplate> {
    return this.repo.activate(key);
  }
}
