/**
 * Port for the system agent-templates catalog (`/api/agents/templates`).
 *
 * Kept separate from {@link IAgentRepository} (Interface Segregation): the
 * templates resource is read-only browse + a single activate action, with no
 * CRUD and its own cache lifecycle. The application layer depends on this
 * interface; the axios-backed implementation lives in
 * `src/infrastructure/repositories/AgentTemplateRepository.ts`.
 */

import type {
  ActivatedAgentTemplate,
  AgentTemplate,
} from '@/domain/types/agentTemplate.types';

/** Browse + activate the BE-owned system agent templates. */
export interface IAgentTemplateRepository {
  /** List the available system agent templates.
   *  Maps to `GET /api/agents/templates`. */
  list(): Promise<AgentTemplate[]>;

  /** Read one template by its system key.
   *  Maps to `GET /api/agents/templates/{key}`. */
  get(key: string): Promise<AgentTemplate>;

  /** Activate a template — copy it into the user's agents. Idempotent on the
   *  server (201 newly created / 200 already existed); both resolve here to an
   *  {@link ActivatedAgentTemplate}. Maps to
   *  `POST /api/agents/templates/{key}/activate`. */
  activate(key: string): Promise<ActivatedAgentTemplate>;
}
