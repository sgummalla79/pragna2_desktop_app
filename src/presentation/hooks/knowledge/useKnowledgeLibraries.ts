/**
 * TanStack Query hooks for the knowledge-library endpoints (RAG Rung 2).
 *
 * Libraries are a top-level resource; documents (sources) are a sub-resource
 * keyed by the library id, so their cache key nests under the library.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type {
  CreateLibraryPayload,
  IngestSourcePayload,
  KnowledgeLibrary,
  KnowledgeSource,
  UploadSourcePayload,
} from '@/domain/types/knowledge.types';

/** Cache key for the user's libraries. */
export const KNOWLEDGE_LIBRARIES_KEY = ['knowledge-libraries'] as const;

/** Cache key for one library's documents. */
export const librarySourcesKey = (libraryId: string) =>
  ['knowledge-libraries', libraryId, 'sources'] as const;

/** Lists the user's active knowledge libraries. */
export function useKnowledgeLibraries() {
  const { knowledgeService } = useServices();
  return useQuery({
    queryKey: KNOWLEDGE_LIBRARIES_KEY,
    queryFn: () => knowledgeService.listLibraries(),
    staleTime: 30_000,
  });
}

/** Creates a knowledge library and invalidates the libraries list. */
export function useCreateLibrary() {
  const { knowledgeService } = useServices();
  const queryClient = useQueryClient();
  return useMutation<KnowledgeLibrary, Error, CreateLibraryPayload>({
    mutationFn: (payload) => knowledgeService.createLibrary(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: KNOWLEDGE_LIBRARIES_KEY }),
  });
}

/** Archives a knowledge library (frees the slug; cascades sources + chunks). */
export function useArchiveLibrary() {
  const { knowledgeService } = useServices();
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => knowledgeService.archiveLibrary(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: KNOWLEDGE_LIBRARIES_KEY }),
  });
}

/** Lists one library's documents. Disabled when `libraryId` is falsy. */
export function useLibrarySources(libraryId: string | null | undefined) {
  const { knowledgeService } = useServices();
  return useQuery({
    queryKey: librarySourcesKey(libraryId ?? ''),
    queryFn: () => knowledgeService.listSources(libraryId as string),
    enabled: !!libraryId,
    staleTime: 30_000,
  });
}

/** Ingests a document into a library (pasted text OR an attachment). */
export function useIngestSource(libraryId: string) {
  const { knowledgeService } = useServices();
  const queryClient = useQueryClient();
  return useMutation<KnowledgeSource, Error, IngestSourcePayload>({
    mutationFn: (payload) => knowledgeService.ingestSource(libraryId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: librarySourcesKey(libraryId) }),
  });
}

/** Uploads a document FILE into a library (PDF / text / docx / xlsx). The BE
 *  extracts the text, then stores + embeds it. */
export function useUploadSource(libraryId: string) {
  const { knowledgeService } = useServices();
  const queryClient = useQueryClient();
  return useMutation<KnowledgeSource, Error, UploadSourcePayload>({
    mutationFn: (payload) => knowledgeService.uploadSource(libraryId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: librarySourcesKey(libraryId) }),
  });
}

/** Deletes a document from a library. */
export function useDeleteSource(libraryId: string) {
  const { knowledgeService } = useServices();
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (sourceId) =>
      knowledgeService.deleteSource(libraryId, sourceId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: librarySourcesKey(libraryId) }),
  });
}
