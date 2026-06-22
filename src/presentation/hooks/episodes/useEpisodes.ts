/**
 * Episode-lifecycle React Query hooks (the read side the chat surface needs).
 *
 * Create + resume are driven imperatively from {@link useChatSession}
 * (`startEpisode` / `submitInterrupt`); this module supplies the **open-episode
 * lookup** the chat surface uses to (a) rehydrate a paused HITL form and (b)
 * detect + attach to a background `create_pdf_long` document episode.
 *
 * Ported from the web app's `useEpisodes.ts` (the open-episode slice).
 */
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useServices } from '@/presentation/providers/ServiceContext';
import { OPEN_EPISODE_ACTIVE_POLL_MS } from '@/constants/episodes';
import type { EpisodeSnapshot } from '@/domain/types/episode.types';

/** Query key for "is there an open episode on this conversation?". */
export function openEpisodeQueryKey(conversationId: string | undefined) {
  return ['conversations', conversationId, 'open-episode'] as const;
}

/**
 * Fetch the open (`active` or `awaiting_user`) episode for a conversation, or
 * `null` when there is none.
 *
 * The backend exposes no direct "open episode" route, so we read the most-recent
 * episode via `episodeService.list(..., {limit:1})` and return it iff its status
 * is open. A partial unique index on
 * `conversation_episodes(conversation_id) WHERE status IN ('active','awaiting_user')`
 * guarantees at most one such row, so "most recent" is sufficient.
 *
 * Disabled when `conversationId` is falsy (a brand-new chat has no episode yet).
 * A 404 (delete/navigate race, or no conversation) resolves to `null`, not an
 * error. The run-settle transition ({@link useRefetchOpenEpisodeOnSettle}) and
 * episode mutations still invalidate it explicitly; additionally, while the
 * returned episode is `active` (e.g. a `create_pdf_long` document generating in
 * the background) the query polls on {@link OPEN_EPISODE_ACTIVE_POLL_MS} so the
 * `active` → terminal transition is observed without a manual chat switch.
 */
export function useOpenEpisode(conversationId: string | undefined) {
  const { episodeService } = useServices();
  return useQuery({
    queryKey: openEpisodeQueryKey(conversationId),
    queryFn: async (): Promise<EpisodeSnapshot | null> => {
      if (!conversationId) return null;
      try {
        const page = await episodeService.list(conversationId, { limit: 1, offset: 0 });
        const first = page.episodes[0];
        if (!first) return null;
        if (first.status === 'active' || first.status === 'awaiting_user') {
          return first;
        }
        return null;
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 404) return null;
        throw e;
      }
    },
    enabled: Boolean(conversationId),
    staleTime: 30_000,
    // Poll only while a background episode is actively generating; an idle/paused
    // (`awaiting_user`) or absent (`null`) episode does not need polling.
    refetchInterval: (query) =>
      query.state.data?.status === 'active' ? OPEN_EPISODE_ACTIVE_POLL_MS : false,
  });
}
