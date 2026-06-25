/**
 * Domain types for the system **agent templates** catalog
 * (`/api/agents/templates`).
 *
 * Distinct from {@link DefaultAgentTemplate} (the singular starter values for
 * the create-default form, `/api/agents/default-template`): these are
 * BE-owned, pre-built *system* agents (e.g. the "Nexus Kit Help & Setup
 * Assistant", `key = nexus-kit-help`) that the user can **activate** to copy
 * into their own agents. Activation is idempotent on the server.
 *
 * The BE serialises in snake_case; the mappers in
 * `infrastructure/repositories/mappers/mapAgentTemplate.ts` translate at the
 * boundary. UI code only sees the camelCase shapes here.
 */

import type { Agent } from '@/domain/types/agent.types';

/** One system agent template (`GET /api/agents/templates[/{key}]`). */
export interface AgentTemplate {
  /** Stable system key (e.g. `nexus-kit-help`). Identifies the template in
   *  the activate call. Immutable. */
  key: string;
  /** URL-safe handle the activated agent will take (subject to per-user
   *  uniqueness on activation). */
  apiName: string;
  /** User-facing label. */
  displayName: string;
  /** Prose describing what the template's agent does. */
  description: string;
  /** The template agent's system prompt. */
  systemPrompt: string;
  /** Bound tool api_names the activated agent will carry. */
  tools: string[];
  /** Static capability: whether this template supports one-click activation at
   *  all (e.g. `false` for the `default` prefill-only template). */
  activatable: boolean;
  /** Per-user state: `true` when the user already has a non-archived agent for
   *  this template. Drives the Activated badge and hides the Activate button. */
  activated: boolean;
}

/**
 * Result of `POST /api/agents/templates/{key}/activate`.
 *
 * The created (or pre-existing) agent, plus activation metadata. `created`
 * distinguishes a fresh activation (HTTP 201) from an idempotent re-activation
 * hitting the existing agent (HTTP 200). When `knowledgeSeeded` is `false`,
 * `knowledgeNote` explains why (e.g. no embedding key configured) — the agent
 * still runs from its built-in overview.
 */
export interface ActivatedAgentTemplate {
  /** The user's agent that now backs this template. */
  agent: Agent;
  /** True when this activation newly created the agent (201); false when it
   *  resolved to an agent that already existed (200). */
  created: boolean;
  /** Whether the template's knowledge base was seeded into a library. */
  knowledgeSeeded: boolean;
  /** Human-readable note shown when `knowledgeSeeded` is false; null otherwise. */
  knowledgeNote: string | null;
}
