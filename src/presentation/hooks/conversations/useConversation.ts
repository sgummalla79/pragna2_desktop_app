import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { Conversation } from '@/domain/types/conversation.types';

/**
 * Resolve a single conversation by id from `GET /api/conversations/{id}`.
 *
 * Drives the chat-header title, the model picker, and the extended-thinking
 * toggle on the chat surface. Returns `null` for `data` when the id isn't owned
 * by the user OR the row doesn't exist (the repo maps BE 404 → `null`). `null`
 * rather than `undefined` because TanStack Query rejects `undefined` returns.
 */
export function useConversation(
  conversationId: string | undefined,
): UseQueryResult<Conversation | null> {
  const { conversationService } = useServices();
  return useQuery<Conversation | null>({
    queryKey: ['conversations', conversationId ?? '__none__', 'single'],
    queryFn: async () => {
      if (!conversationId) return null;
      return conversationService.get(conversationId);
    },
    enabled: Boolean(conversationId),
    staleTime: 30_000,
  });
}
