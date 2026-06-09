/**
 * TanStack Query hooks for the per-user embedding (Voyage) key (RAG Rung 2).
 *
 * The key is write-only — we only ever read its presence (`hasVoyageKey`), set
 * it, or clear it.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { EmbeddingKeyStatus } from '@/domain/types/embeddingKey.types';

/** Cache key for the embedding-key status. */
export const EMBEDDING_KEY_STATUS_KEY = ['embedding-key'] as const;

/** Whether the user has a per-user embedding key set. */
export function useEmbeddingKeyStatus() {
  const { embeddingKeyService } = useServices();
  return useQuery({
    queryKey: EMBEDDING_KEY_STATUS_KEY,
    queryFn: () => embeddingKeyService.getStatus(),
    staleTime: 30_000,
  });
}

/** Set/replace the embedding key (validated server-side via a live probe). */
export function useSetEmbeddingKey() {
  const { embeddingKeyService } = useServices();
  const queryClient = useQueryClient();
  return useMutation<EmbeddingKeyStatus, Error, string>({
    mutationFn: (apiKey) => embeddingKeyService.setKey(apiKey),
    onSuccess: (status) => queryClient.setQueryData(EMBEDDING_KEY_STATUS_KEY, status),
  });
}

/** Remove the embedding key (embeddings fall back to the deployment key). */
export function useClearEmbeddingKey() {
  const { embeddingKeyService } = useServices();
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => embeddingKeyService.clearKey(),
    onSuccess: () =>
      queryClient.setQueryData(EMBEDDING_KEY_STATUS_KEY, { hasVoyageKey: false }),
  });
}
