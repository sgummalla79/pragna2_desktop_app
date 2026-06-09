import type { IAgentRepository } from '@/application/ports/IAgentRepository';
import type {
  Agent,
  CreateAgentPayload,
  DefaultAgentTemplate,
  UpdateAgentPayload,
} from '@/domain/types/agent.types';
import type {
  AgentConnector,
  AttachAgentConnectorPayload,
  UpdateAgentConnectorPayload,
} from '@/domain/types/agentConnector.types';

/**
 * Manages the user's standalone agents via the `/api/agents/*` endpoints.
 * Thin facade over the repository.
 */
export class AgentService {
  constructor(private readonly repo: IAgentRepository) {}

  /** Lists the user's agents (archived excluded unless `includeArchived`). */
  list(includeArchived = false): Promise<Agent[]> {
    return this.repo.list(includeArchived);
  }

  /** Reads one agent by id. */
  get(id: string): Promise<Agent> {
    return this.repo.get(id);
  }

  /** The user's default agent, or `null` when none exists yet. */
  getDefault(): Promise<Agent | null> {
    return this.repo.getDefault();
  }

  /** Starter values to prefill the create-default form. */
  getDefaultTemplate(): Promise<DefaultAgentTemplate> {
    return this.repo.getDefaultTemplate();
  }

  /** Creates an agent (optionally as the new default). */
  create(payload: CreateAgentPayload): Promise<Agent> {
    return this.repo.create(payload);
  }

  /** Patches an agent's mutable fields. */
  update(id: string, payload: UpdateAgentPayload): Promise<Agent> {
    return this.repo.update(id, payload);
  }

  /** Promotes an agent to default (atomic; prior default demoted). */
  setDefault(id: string): Promise<Agent> {
    return this.repo.setDefault(id);
  }

  /** Soft-archives an agent. */
  archive(id: string): Promise<void> {
    return this.repo.archive(id);
  }

  // ── MCP connector attachments (sub-resource) ──────────────────────────────

  /** Lists the connectors attached to an agent. */
  listConnectors(agentId: string): Promise<AgentConnector[]> {
    return this.repo.listConnectors(agentId);
  }

  /** Attaches a connector to an agent. */
  attachConnector(
    agentId: string,
    payload: AttachAgentConnectorPayload,
  ): Promise<AgentConnector> {
    return this.repo.attachConnector(agentId, payload);
  }

  /** Updates a binding's per-tool selection. */
  updateConnector(
    agentId: string,
    bindingId: string,
    payload: UpdateAgentConnectorPayload,
  ): Promise<AgentConnector> {
    return this.repo.updateConnector(agentId, bindingId, payload);
  }

  /** Detaches a connector binding. */
  detachConnector(agentId: string, bindingId: string): Promise<void> {
    return this.repo.detachConnector(agentId, bindingId);
  }
}
