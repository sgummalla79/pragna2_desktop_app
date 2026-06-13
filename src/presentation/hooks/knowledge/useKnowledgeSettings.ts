/**
 * TanStack Query hooks for the per-user knowledge / retrieval settings (RAG Rung 2).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type {
  KnowledgeSettings,
  KnowledgeSettingsUpdate,
} from '@/domain/types/knowledgeSettings.types';

/** Cache key for the knowledge settings. */
export const KNOWLEDGE_SETTINGS_KEY = ['knowledge-settings'] as const;

/** The user's resolved knowledge settings (defaults + overrides). */
export function useKnowledgeSettings() {
  const { knowledgeSettingsService } = useServices();
  return useQuery({
    queryKey: KNOWLEDGE_SETTINGS_KEY,
    queryFn: () => knowledgeSettingsService.get(),
    staleTime: 30_000,
  });
}

/** Partial-merge an update; the resolved settings replace the cache on success. */
export function useUpdateKnowledgeSettings() {
  const { knowledgeSettingsService } = useServices();
  const queryClient = useQueryClient();
  return useMutation<KnowledgeSettings, Error, KnowledgeSettingsUpdate>({
    mutationFn: (patch) => knowledgeSettingsService.update(patch),
    onSuccess: (settings) => queryClient.setQueryData(KNOWLEDGE_SETTINGS_KEY, settings),
  });
}
