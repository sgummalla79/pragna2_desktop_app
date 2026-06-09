import { useMemo } from 'react';
import { useModels } from '@/presentation/hooks/models/useModels';
import type { Model } from '@/domain/types/model.types';

export interface UseChatModelsResult {
  /** Chat-eligible models: enabled, available for chat, not archived. */
  chatModels: Model[];
  /** True while the underlying models query is loading. */
  isLoading: boolean;
}

/**
 * The user's chat-eligible models, derived from the shared `useModels` cache.
 *
 * "Chat-eligible" = `enabled && availableForChat && !archived`. Used by the
 * model picker (options), the composer gating (empty → no chat model), and the
 * landing's default-model selection. Single source of truth so all three agree.
 */
export function useChatModels(): UseChatModelsResult {
  const { data: models, isLoading } = useModels();
  const chatModels = useMemo<Model[]>(
    () => (models ?? []).filter((m) => m.enabled && m.availableForChat && !m.archived),
    [models],
  );
  return { chatModels, isLoading };
}
