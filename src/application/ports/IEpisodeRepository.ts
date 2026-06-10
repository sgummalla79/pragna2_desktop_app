import type {
  EpisodeListPage,
  EpisodeSnapshot,
} from '@/domain/types/episode.types';

/** Pagination options for listing episodes. */
export interface ListEpisodesOptions {
  limit?: number;
  offset?: number;
}

/**
 * Port for the **read** side of HITL episodes (`GET /api/conversations/{id}/
 * episodes[...]`). The **start** and **resume** runs are SSE and stream through
 * the chat transport (`TauriHttpAgent.runRaw`), so they are deliberately NOT on
 * this repository — keeping the interface segregated (it only does reads).
 */
export interface IEpisodeRepository {
  /** List a conversation's episodes, newest first (paginated). */
  list(
    conversationId: string,
    options?: ListEpisodesOptions,
  ): Promise<EpisodeListPage>;

  /** Read a single episode by id (within a conversation). */
  get(conversationId: string, episodeId: string): Promise<EpisodeSnapshot>;
}
