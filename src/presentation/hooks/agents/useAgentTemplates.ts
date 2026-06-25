/**
 * TanStack Query hooks for the system agent-templates catalog
 * (`/api/agents/templates`).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import { AGENTS_KEY } from '@/presentation/hooks/agents/useAgents';
import type {
  ActivatedAgentTemplate,
  AgentTemplate,
} from '@/domain/types/agentTemplate.types';

/** Cache key for the system agent-templates list. */
export const AGENT_TEMPLATES_KEY = ['agent-templates'] as const;

/** List the available system agent templates (e.g. the Help & Setup Assistant). */
export function useAgentTemplates(enabled = true) {
  const { agentTemplateService } = useServices();
  return useQuery<AgentTemplate[]>({
    queryKey: AGENT_TEMPLATES_KEY,
    queryFn: () => agentTemplateService.list(),
    staleTime: 60_000,
    enabled,
  });
}

/**
 * Activate a system template by key (idempotent on the server).
 *
 * Cache invalidation is conditional on seeding outcome:
 * - `knowledgeSeeded: true` — full success: refresh agents list (agent appears
 *   above) and templates list (activatable flips false, Activate button hides).
 * - `knowledgeSeeded: false` — partial failure: seeding failed so the agent
 *   should NOT yet appear in the user's agents list. Neither list is
 *   invalidated; the Activate button stays so the user can retry.
 */
export function useActivateAgentTemplate() {
  const { agentTemplateService } = useServices();
  const qc = useQueryClient();
  return useMutation<ActivatedAgentTemplate, Error, string>({
    mutationFn: (key) => agentTemplateService.activate(key),
    onSuccess: (result) => {
      if (result.knowledgeSeeded) {
        qc.invalidateQueries({ queryKey: AGENTS_KEY });
        qc.invalidateQueries({ queryKey: AGENT_TEMPLATES_KEY });
      }
    },
  });
}
