import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { PersistedMessage } from '@/domain/types/conversation.types';

const KEY = (id: string | undefined) =>
  ['conversations', id ?? '__none__', 'messages'] as const;

interface UseConversationMessagesOptions {
  /**
   * When `false`, suppress the network fetch entirely. The session view passes
   * `false` for brand-new conversations whose row hasn't been persisted yet, to
   * avoid a structurally-guaranteed 404. Defaults to `true`.
   */
  enabled?: boolean;
}

/**
 * Fetch the persisted message log for a conversation (resume / hydration).
 *
 * History is effectively immutable client-side, so `staleTime: Infinity` is the
 * right policy — we only refetch on explicit invalidation (after a new turn
 * finishes streaming). The repo maps 404 → `[]`, so the queryFn never throws on
 * a missing row.
 */
export function useConversationMessages(
  conversationId: string | undefined,
  options: UseConversationMessagesOptions = {},
) {
  const { conversationService } = useServices();
  const enabled = (options.enabled ?? true) && Boolean(conversationId);
  return useQuery<PersistedMessage[]>({
    queryKey: KEY(conversationId),
    queryFn: () => conversationService.getMessages(conversationId!),
    enabled,
    staleTime: Infinity,
  });
}
