/**
 * Port for the agents repository (standalone `/api/agents` resource).
 *
 * Application layer depends on this interface; the axios-backed
 * implementation lives in `src/infrastructure/repositories/AgentRepository.ts`.
 */

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

/** CRUD for the user's standalone agents and their connector bindings. */
export interface IAgentRepository {
  /** List the user's agents. `includeArchived` adds archived rows.
   *  Maps to `GET /api/agents`. */
  list(includeArchived?: boolean): Promise<Agent[]>;

  /** Read one agent. Maps to `GET /api/agents/{id}`. */
  get(id: string): Promise<Agent>;

  /** The user's current default agent, or `null` when none exists yet
   *  (the BE returns 404 → the FE shows the create-default banner).
   *  Maps to `GET /api/agents/default`. */
  getDefault(): Promise<Agent | null>;

  /** Starter values to prefill the create-default form.
   *  Maps to `GET /api/agents/default-template`. */
  getDefaultTemplate(): Promise<DefaultAgentTemplate>;

  /** Create an agent (optionally marking it default).
   *  Maps to `POST /api/agents`. */
  create(payload: CreateAgentPayload): Promise<Agent>;

  /** Partial update (never `apiName` / `isDefault`).
   *  Maps to `PATCH /api/agents/{id}`. */
  update(id: string, payload: UpdateAgentPayload): Promise<Agent>;

  /** Make this agent the user's default (atomic swap demotes the prior
   *  default). Maps to `POST /api/agents/{id}/set-default`. */
  setDefault(id: string): Promise<Agent>;

  /** Soft-archive (frees the handle). Maps to `DELETE /api/agents/{id}`. */
  archive(id: string): Promise<void>;

  // ── MCP connector attachments (sub-resource) ──────────────────────────────

  /** List the connectors attached to an agent.
   *  Maps to `GET /api/agents/{agentId}/connectors`. */
  listConnectors(agentId: string): Promise<AgentConnector[]>;

  /** Attach a connector (with an optional per-tool selection).
   *  Maps to `POST /api/agents/{agentId}/connectors` (201). */
  attachConnector(
    agentId: string,
    payload: AttachAgentConnectorPayload,
  ): Promise<AgentConnector>;

  /** Update a binding's per-tool selection.
   *  Maps to `PATCH /api/agents/{agentId}/connectors/{bindingId}`. */
  updateConnector(
    agentId: string,
    bindingId: string,
    payload: UpdateAgentConnectorPayload,
  ): Promise<AgentConnector>;

  /** Detach a connector binding.
   *  Maps to `DELETE /api/agents/{agentId}/connectors/{bindingId}` (204). */
  detachConnector(agentId: string, bindingId: string): Promise<void>;
}
