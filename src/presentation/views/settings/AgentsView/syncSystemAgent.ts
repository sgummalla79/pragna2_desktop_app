/**
 * Pure helpers backing the "Update to latest" action for **system agents**.
 *
 * A system agent is a per-user copy made when the user activated a BE-owned
 * system template (e.g. the Nexus Kit Help & Setup Assistant). The backend
 * freezes that copy at activation time — when the template later changes
 * (new system prompt, tools, …) the user's instance does NOT auto-refresh, and
 * there is no BE refresh/sync endpoint or version field (see the
 * `system-agent-update-to-latest` technical spec). This module lets the FE
 * re-sync the instance to the latest template via the existing
 * `PATCH /api/agents/{id}`: it links an instance back to its source template by
 * `apiName` (the same key the BE matches on at activation), decides whether the
 * instance is stale, and builds the patch body.
 *
 * All functions here are pure (no I/O, no React) so they can be unit-tested in
 * isolation; the orchestration lives in `useSyncSystemAgent`.
 */

import type { Agent, UpdateAgentPayload } from '@/domain/types/agent.types';
import type { AgentTemplate } from '@/domain/types/agentTemplate.types';
import {
  SYSTEM_AGENT_METADATA_KEY,
  SYSTEM_AGENT_ROLE_HELP_SETUP,
} from './constants';

/**
 * Whether `agent` is a BE-owned system agent (carries the help/setup sentinel
 * in its metadata). System agents are read-only in the UI and are the only
 * agents eligible for "Update to latest".
 */
export function isSystemAgent(agent: Agent): boolean {
  return agent.metadata?.[SYSTEM_AGENT_METADATA_KEY] === SYSTEM_AGENT_ROLE_HELP_SETUP;
}

/**
 * Finds the source template for a system agent among `templates`, or
 * `undefined` when none matches (e.g. the template was removed on the BE).
 *
 * Linkage is by `apiName`: activation copies the template's `api_name` onto the
 * created agent and matches on it, so it is the authoritative instance↔template
 * key. (There is no `template_key`/version column on the BE — see the spec.)
 */
export function findTemplateForAgent(
  agent: Agent,
  templates: readonly AgentTemplate[],
): AgentTemplate | undefined {
  return templates.find((t) => t.apiName === agent.apiName);
}

/** Order-insensitive set equality for two tool-name lists. */
function sameTools(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((tool) => set.has(tool));
}

/**
 * Whether the user's system `agent` is stale relative to its source `template`
 * — i.e. any synced field (display name, description, system prompt, tools)
 * differs. Drives whether the "Update to latest" affordance is shown; when this
 * is `false` the instance already matches the template and a patch would be a
 * no-op.
 *
 * `description` is normalised (`null`/`undefined` → `''`) because the agent
 * column is nullable while the template's is always a string.
 */
export function systemAgentNeedsUpdate(
  agent: Agent,
  template: AgentTemplate,
): boolean {
  return (
    agent.displayName !== template.displayName ||
    (agent.description ?? '') !== (template.description ?? '') ||
    agent.systemPrompt !== template.systemPrompt ||
    !sameTools(agent.tools, template.tools)
  );
}

/**
 * Builds the `PATCH /api/agents/{id}` body that re-syncs an instance to its
 * `template`. Only the template-owned fields are sent; `apiName` (immutable),
 * `isDefault` (set-default endpoint), `status`, and `metadata` (preserves the
 * system sentinel) are deliberately left untouched.
 */
export function buildSyncPayload(template: AgentTemplate): UpdateAgentPayload {
  return {
    displayName: template.displayName,
    description: template.description,
    systemPrompt: template.systemPrompt,
    tools: template.tools,
  };
}
