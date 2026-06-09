/**
 * TanStack Query hooks for the `/api/agents` endpoints (standalone agents).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type {
  Agent,
  CreateAgentPayload,
  DefaultAgentTemplate,
  UpdateAgentPayload,
} from '@/domain/types/agent.types';

/** Cache key for the agent list. Exported for cross-hook invalidation. */
export const AGENTS_KEY = ['agents'] as const;
/** Cache key for the "current default agent" query (drives the chat gate). */
export const DEFAULT_AGENT_KEY = ['agents', 'default'] as const;
/** Cache key for the BE-owned create-default starter template. */
export const DEFAULT_AGENT_TEMPLATE_KEY = ['agents', 'default-template'] as const;

/** List the user's agents (archived excluded by default). */
export function useAgents(includeArchived = false) {
  const { agentService } = useServices();
  return useQuery({
    queryKey: [...AGENTS_KEY, { includeArchived }] as const,
    queryFn: () => agentService.list(includeArchived),
    staleTime: 30_000,
  });
}

/** The user's current default agent, or `null` when none exists yet.
 *  Chat readiness is gated on a non-null result. */
export function useDefaultAgent() {
  const { agentService } = useServices();
  return useQuery<Agent | null>({
    queryKey: DEFAULT_AGENT_KEY,
    queryFn: () => agentService.getDefault(),
    staleTime: 30_000,
  });
}

/** Starter template for the create-default form (constant-driven, BE-owned). */
export function useDefaultAgentTemplate(enabled = true) {
  const { agentService } = useServices();
  return useQuery<DefaultAgentTemplate>({
    queryKey: DEFAULT_AGENT_TEMPLATE_KEY,
    queryFn: () => agentService.getDefaultTemplate(),
    staleTime: Infinity,
    enabled,
  });
}

/** Invalidate every agents query (list, default, …) after a mutation. */
function useInvalidateAgents() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: AGENTS_KEY });
}

/** Create an agent. Invalidates the agents list + default queries. */
export function useCreateAgent() {
  const { agentService } = useServices();
  const invalidate = useInvalidateAgents();
  return useMutation<Agent, Error, CreateAgentPayload>({
    mutationFn: (payload) => agentService.create(payload),
    onSuccess: invalidate,
  });
}

/** Patch an agent's mutable fields. Invalidates the agents list. */
export function useUpdateAgent() {
  const { agentService } = useServices();
  const invalidate = useInvalidateAgents();
  return useMutation<Agent, Error, { id: string; payload: UpdateAgentPayload }>({
    mutationFn: ({ id, payload }) => agentService.update(id, payload),
    onSuccess: invalidate,
  });
}

/** Promote an agent to default. Invalidates the agents list + default. */
export function useSetDefaultAgent() {
  const { agentService } = useServices();
  const invalidate = useInvalidateAgents();
  return useMutation<Agent, Error, string>({
    mutationFn: (id) => agentService.setDefault(id),
    onSuccess: invalidate,
  });
}

/** Soft-archive an agent. Invalidates the agents list + default. */
export function useArchiveAgent() {
  const { agentService } = useServices();
  const invalidate = useInvalidateAgents();
  return useMutation<void, Error, string>({
    mutationFn: (id) => agentService.archive(id),
    onSuccess: invalidate,
  });
}
