/**
 * Domain types for the `/api/agents` endpoints (standalone agents).
 *
 * Distinct from the agents inlined onto a flow's nodes (those are authored
 * in the flow editor). An `Agent` here is a user-owned, standalone chat
 * agent. The user's **default** chat agent is the row with `isDefault: true`
 * — deliberately created by the user; chat is gated on it existing.
 *
 * The BE serialises in snake_case; the mappers in
 * `infrastructure/repositories/mappers/mapAgent.ts` translate at the boundary.
 * UI code only sees the camelCase shapes here.
 */

/** Lifecycle status — mirrors the BE `agents.status` column.
 *  `active` = usable; `inactive` = parked; `archived` = soft-deleted. */
export type AgentStatus = 'active' | 'inactive' | 'archived';

/** One row from the `/api/agents` endpoints. */
export interface Agent {
  /** UUID of the agents record. */
  id: string;
  /** URL-safe kebab handle, unique per user among non-archived agents.
   *  Immutable after create. */
  apiName: string;
  /** User-facing label. */
  displayName: string;
  /** Optional prose describing the agent. */
  description: string | null;
  /** The agent's system prompt. */
  systemPrompt: string;
  /** Bound tool api_names (references the tools table). */
  tools: string[];
  /** True for the user's default chat agent — the one loaded on sign-in.
   *  At most one per user. */
  isDefault: boolean;
  /** Lifecycle status. */
  status: AgentStatus;
  /** Escape-hatch for future per-agent flags. */
  metadata: Record<string, unknown>;
  /** ISO-8601 timestamps from the BE. */
  createdAt: string;
  modifiedAt: string;
}

/** Starter values for the create-default-agent form
 *  (`GET /api/agents/default-template`). */
export interface DefaultAgentTemplate {
  apiName: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  tools: string[];
}

/** Body for `POST /api/agents`. */
export interface CreateAgentPayload {
  apiName: string;
  displayName: string;
  description?: string | null;
  systemPrompt?: string;
  tools?: string[];
  /** When true, this agent becomes the user's default (any prior default
   *  is demoted atomically). The onboarding banner sets this. */
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
}

/** Body for `PATCH /api/agents/{id}` — all fields optional. `apiName`
 *  (immutable) and `isDefault` (changed only via set-default) are NOT
 *  updatable here. */
export interface UpdateAgentPayload {
  displayName?: string;
  description?: string | null;
  systemPrompt?: string;
  tools?: string[];
  status?: AgentStatus;
  metadata?: Record<string, unknown>;
}
