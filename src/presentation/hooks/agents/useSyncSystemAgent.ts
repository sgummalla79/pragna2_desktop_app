/**
 * TanStack Query hook for "Update to latest" on a **system agent**.
 *
 * Re-syncs the user's frozen system-agent instance to the current state of its
 * source system template. The backend has no refresh/sync endpoint and no
 * version field, so this orchestrates the two existing endpoints: it fetches the
 * latest template (`GET /api/agents/templates/{key}`) and patches the instance
 * (`PATCH /api/agents/{id}`) with the template-owned fields. On success it
 * invalidates both the agents list (the patched row changed) and the templates
 * list (its derived state may have changed), mirroring
 * {@link useActivateAgentTemplate}.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import { AGENTS_KEY } from '@/presentation/hooks/agents/useAgents';
import { AGENT_TEMPLATES_KEY } from '@/presentation/hooks/agents/useAgentTemplates';
import { buildSyncPayload } from '@/presentation/views/settings/AgentsView/syncSystemAgent';
import type { Agent } from '@/domain/types/agent.types';

/** Arguments for {@link useSyncSystemAgent}: which instance, which template. */
export interface SyncSystemAgentArgs {
  /** UUID of the user's system-agent instance to patch. */
  agentId: string;
  /** System key of the source template to pull the latest values from. */
  templateKey: string;
}

/**
 * Mutation that updates a system agent to its latest template. Fetches the
 * freshest template by key (not the possibly-stale cached list) before
 * patching, so the user always lands on the current version.
 */
export function useSyncSystemAgent() {
  const { agentService, agentTemplateService } = useServices();
  const qc = useQueryClient();
  return useMutation<Agent, Error, SyncSystemAgentArgs>({
    mutationFn: async ({ agentId, templateKey }) => {
      const template = await agentTemplateService.get(templateKey);
      return agentService.update(agentId, buildSyncPayload(template));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY });
      qc.invalidateQueries({ queryKey: AGENT_TEMPLATES_KEY });
    },
  });
}
