/**
 * TanStack Query hooks for an agent's MCP-connector attachments
 * (`/api/agents/{id}/connectors`).
 *
 * Bindings are a sub-resource keyed by agent id, so the query key nests under
 * the agent. Mutations apply immediately (separate endpoints from the agent
 * PATCH) and invalidate this agent's binding list.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type {
  AgentConnector,
  AttachAgentConnectorPayload,
  UpdateAgentConnectorPayload,
} from '@/domain/types/agentConnector.types';

/** Cache key for one agent's connector bindings. */
export const agentConnectorsKey = (agentId: string) =>
  ['agents', agentId, 'connectors'] as const;

/** List the connectors attached to an agent. Disabled when `agentId` is
 *  falsy (e.g. the agent hasn't been created yet — create mode). */
export function useAgentConnectors(agentId: string | null | undefined) {
  const { agentService } = useServices();
  return useQuery({
    queryKey: agentConnectorsKey(agentId ?? ''),
    queryFn: () => agentService.listConnectors(agentId as string),
    enabled: !!agentId,
    staleTime: 30_000,
  });
}

/** Attach a connector to the agent. */
export function useAttachAgentConnector(agentId: string) {
  const { agentService } = useServices();
  const qc = useQueryClient();
  return useMutation<AgentConnector, Error, AttachAgentConnectorPayload>({
    mutationFn: (payload) => agentService.attachConnector(agentId, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: agentConnectorsKey(agentId) }),
  });
}

/** Update a binding's per-tool selection. */
export function useUpdateAgentConnector(agentId: string) {
  const { agentService } = useServices();
  const qc = useQueryClient();
  return useMutation<
    AgentConnector,
    Error,
    { bindingId: string; payload: UpdateAgentConnectorPayload }
  >({
    mutationFn: ({ bindingId, payload }) =>
      agentService.updateConnector(agentId, bindingId, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: agentConnectorsKey(agentId) }),
  });
}

/** Detach a connector binding. */
export function useDetachAgentConnector(agentId: string) {
  const { agentService } = useServices();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (bindingId) => agentService.detachConnector(agentId, bindingId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: agentConnectorsKey(agentId) }),
  });
}
