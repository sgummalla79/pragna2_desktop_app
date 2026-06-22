import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateConversationListQueries } from '@/presentation/hooks/conversations/useConversations';
import type { EpisodeSnapshot } from '@/domain/types/episode.types';

/**
 * Surface a finished background document episode without a manual chat switch.
 *
 * A `create_pdf_long` request generates its PDF in a background episode that runs
 * for minutes after the chat run already settled, then posts the document back as
 * a new assistant message. The chat surface attaches to that episode's SSE
 * stream, but a multi-minute stream is fragile (it can drop before the
 * `RUN_FINISHED` that triggers the messages refetch), which left the
 * {@link DocumentCard} appearing only after the user switched chats and back.
 *
 * This hook is the robust, stream-independent safety net: it watches the
 * open-episode query (which {@link useOpenEpisode} now polls while `active`) and,
 * on the `active` → not-active transition — the moment the document turn has been
 * persisted — refetches the conversation's messages (and conversation list) so
 * the card surfaces on its own.
 *
 * @param episode - The current open-episode snapshot, or `null` when there is
 *   none open. `useOpenEpisode` returns `null` once the episode reaches a
 *   terminal state, which is what drives the transition this hook detects.
 * @param conversationId - The active conversation id, or `undefined` before one
 *   is known. No invalidation fires while undefined.
 */
export function useSurfaceFinishedEpisode(
  episode: EpisodeSnapshot | null | undefined,
  conversationId: string | undefined,
): void {
  const queryClient = useQueryClient();
  const wasActiveRef = useRef(false);

  useEffect(() => {
    const isActive = episode?.status === 'active';
    const wasActive = wasActiveRef.current;
    wasActiveRef.current = isActive;

    if (wasActive && !isActive && conversationId) {
      queryClient.invalidateQueries({
        queryKey: ['conversations', conversationId, 'messages'],
      });
      invalidateConversationListQueries(queryClient, { conversationId });
    }
  }, [episode, conversationId, queryClient]);
}
