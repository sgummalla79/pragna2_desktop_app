import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type {
  CreateFlowPayload,
  UpdateFlowSlashExposurePayload,
} from '@/domain/types/flow.types';

const FLOWS_KEY = ['flows'] as const;
const flowKey = (id: string) => ['flows', id] as const;
/** Reserved for the chat slash popover (deferred — see docs/TODO.md TD-013). */
const PRAGNA_FLOWS_KEY = ['pragna', 'flows'] as const;

/** List the user's flows. */
export function useFlows() {
  const { flowService } = useServices();
  return useQuery({
    queryKey: FLOWS_KEY,
    queryFn: () => flowService.list(),
    staleTime: 30_000,
  });
}

/** Read a single flow (with nodes + edges + verbatim YAML). */
export function useFlow(id: string | undefined) {
  const { flowService } = useServices();
  return useQuery({
    queryKey: flowKey(id ?? '__none__'),
    queryFn: () => flowService.get(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/** Create a flow (minimal `{ api_name, display_name }`, optional starter YAML). */
export function useCreateFlow() {
  const { flowService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFlowPayload) => flowService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: FLOWS_KEY }),
  });
}

/** Delete a flow. */
export function useDeleteFlow() {
  const { flowService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => flowService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: FLOWS_KEY }),
  });
}

/** Validate a YAML flow document (errors render inline; never rejects on 4xx). */
export function useValidateFlowYaml() {
  const { flowService } = useServices();
  return useMutation({
    mutationFn: (definition: string) => flowService.validateYaml(definition),
  });
}

/** Save a YAML-authored flow by id (update existing; supports rename). */
export function useSaveFlowFromYamlById() {
  const { flowService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ flowId, definition }: { flowId: string; definition: string }) =>
      flowService.saveFromYamlById(flowId, definition),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: FLOWS_KEY });
      qc.invalidateQueries({ queryKey: flowKey(result.flow.id) });
      qc.invalidateQueries({ queryKey: PRAGNA_FLOWS_KEY });
    },
  });
}

/** Save a YAML-authored flow by api_name (create or update). */
export function useSaveFlowFromYaml() {
  const { flowService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (definition: string) => flowService.saveFromYaml(definition),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: FLOWS_KEY });
      qc.invalidateQueries({ queryKey: flowKey(result.flow.id) });
      qc.invalidateQueries({ queryKey: PRAGNA_FLOWS_KEY });
    },
  });
}

/** Toggle slash exposure + set/clear the slash name. */
export function useUpdateFlowSlashExposure() {
  const { flowService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      flowId,
      payload,
    }: {
      flowId: string;
      payload: UpdateFlowSlashExposurePayload;
    }) => flowService.updateSlashExposure(flowId, payload),
    onSuccess: (flow) => {
      qc.invalidateQueries({ queryKey: FLOWS_KEY });
      qc.invalidateQueries({ queryKey: flowKey(flow.id) });
      // Chat's slash popover (deferred) reads this; harmless no-op until then.
      qc.invalidateQueries({ queryKey: PRAGNA_FLOWS_KEY });
    },
  });
}
