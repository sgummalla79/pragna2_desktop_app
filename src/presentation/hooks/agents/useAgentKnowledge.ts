/**
 * TanStack Query hooks for an agent's knowledge-library attachments
 * (`/api/agents/{id}/knowledge-libraries`).
 *
 * Bindings are a sub-resource keyed by agent id, so the query key nests under
 * the agent. Mutations apply immediately and invalidate this agent's binding
 * list. Mirrors `useAgentConnectors`. The binding endpoints live on the shared
 * `KnowledgeService` (the agent-binding methods were added back onto Knowledge).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type {
  AgentKnowledgeLibrary,
  AttachLibraryPayload,
} from '@/domain/types/knowledge.types';

/** Cache key for one agent's knowledge-library bindings. */
export const agentKnowledgeKey = (agentId: string) =>
  ['agents', agentId, 'knowledge-libraries'] as const;

/** List the libraries attached to an agent. Disabled when `agentId` is falsy
 *  (e.g. the agent hasn't been created yet — create mode). */
export function useAgentKnowledge(agentId: string | null | undefined) {
  const { knowledgeService } = useServices();
  return useQuery({
    queryKey: agentKnowledgeKey(agentId ?? ''),
    queryFn: () => knowledgeService.listAgentLibraries(agentId as string),
    enabled: !!agentId,
    staleTime: 30_000,
  });
}

/** Attach a library to the agent. */
export function useAttachAgentKnowledge(agentId: string) {
  const { knowledgeService } = useServices();
  const qc = useQueryClient();
  return useMutation<AgentKnowledgeLibrary, Error, AttachLibraryPayload>({
    mutationFn: (payload) =>
      knowledgeService.attachAgentLibrary(agentId, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: agentKnowledgeKey(agentId) }),
  });
}

/** Detach a library binding. */
export function useDetachAgentKnowledge(agentId: string) {
  const { knowledgeService } = useServices();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (bindingId) =>
      knowledgeService.detachAgentLibrary(agentId, bindingId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: agentKnowledgeKey(agentId) }),
  });
}
