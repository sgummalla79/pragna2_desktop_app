import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { openEpisodeQueryKey } from '@/presentation/hooks/episodes/useEpisodes';
import type { ChatStatus } from './useChatSession';

/**
 * Invalidate the open-episode query when a chat run finishes streaming.
 *
 * When a chat run finalizes, the BE may have JUST spawned a background document
 * episode (`create_pdf_long` acks instantly, then generates the doc in a
 * separate episode created before the ack's `RUN_FINISHED`).
 * {@link useChatSession}'s `onRunFinalized` invalidates messages + the
 * conversation list but NOT the open-episode query — so without this the new
 * doc episode is never discovered, the auto-attach effect never fires, and the
 * posted-back document only appears on a manual reload. Refetching the
 * open-episode query on the `running`→settled transition picks the doc episode
 * up.
 *
 * Extracted from {@link ChatSessionView} so the transition logic is
 * unit-testable without standing up the whole view's hook graph. Ported from the
 * web app.
 *
 * @param status - The current chat run status from {@link useChatSession}.
 * @param conversationId - The active conversation id, or `undefined` before one
 *   is known. No invalidation fires while undefined.
 */
export function useRefetchOpenEpisodeOnSettle(
  status: ChatStatus,
  conversationId: string | undefined,
): void {
  const queryClient = useQueryClient();
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasRunning = prevStatusRef.current === 'running';
    prevStatusRef.current = status;
    if (wasRunning && status !== 'running' && conversationId) {
      queryClient.invalidateQueries({
        queryKey: openEpisodeQueryKey(conversationId),
      });
    }
  }, [status, conversationId, queryClient]);
}
