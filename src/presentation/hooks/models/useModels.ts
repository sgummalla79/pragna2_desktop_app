import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { BulkUpdateEntry, UpdateModelPayload } from '@/domain/types/model.types';

const MODELS_KEY                  = ['models']                           as const;
const LLM_PROVIDERS_WITH_REG_KEY  = ['llm-providers-with-registrations'] as const;

/** Fetches all of the user's models (archived rows excluded by default). */
export function useModels() {
  const { modelService } = useServices();
  return useQuery({
    queryKey: MODELS_KEY,
    queryFn:  () => modelService.list(),
    staleTime: 30_000,
  });
}

/**
 * Partially updates a model's user-controllable fields via PATCH /api/user-models/{id}.
 * On success invalidates the models list so all consumers reflect the change.
 */
export function useUpdateModel() {
  const { modelService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateModelPayload }) =>
      modelService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MODELS_KEY });
      queryClient.invalidateQueries({ queryKey: LLM_PROVIDERS_WITH_REG_KEY });
    },
  });
}

/**
 * Applies many partial updates in a single server transaction via
 * PATCH /api/user-models. All-or-nothing semantics — the whole batch
 * succeeds or rolls back. On success invalidates the models list.
 */
export function useBulkUpdateModels() {
  const { modelService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: BulkUpdateEntry[]) => modelService.bulkUpdate(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MODELS_KEY });
      queryClient.invalidateQueries({ queryKey: LLM_PROVIDERS_WITH_REG_KEY });
    },
  });
}
