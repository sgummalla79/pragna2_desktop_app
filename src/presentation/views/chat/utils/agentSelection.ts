import type { Agent } from '@/domain/types/agent.types';

/**
 * Resolve the active agent a chat composer should treat as **selected**.
 *
 * This is the single source of truth shared by {@link AgentPicker} (what the
 * trigger displays) and the new-chat landing (what `create` pins), so the agent
 * shown and the agent sent can never drift apart. An agent is never "unselected"
 * while any active agent exists: the pinned id wins when still active, otherwise
 * the user's default (`isDefault`), otherwise the first active agent.
 *
 * @param activeAgents - the user's `status === 'active'` agents (already filtered).
 * @param pinnedId - the explicitly chosen agent id, or `null` when none was picked.
 * @returns the resolved active agent id, or `null` only when there are **no**
 *   active agents (the caller then lets the backend seed its own default).
 */
export function resolveActiveAgentId(
  activeAgents: Agent[],
  pinnedId: string | null,
): string | null {
  if (activeAgents.length === 0) return null;
  return (
    (pinnedId && activeAgents.find((a) => a.id === pinnedId)?.id) ??
    activeAgents.find((a) => a.isDefault)?.id ??
    activeAgents[0].id
  );
}
