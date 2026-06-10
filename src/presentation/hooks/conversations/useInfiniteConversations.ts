import { useInfiniteQuery } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { Conversation } from '@/domain/types/conversation.types';

/** Query key for the infinite (browse-all) conversation list. */
const INFINITE_KEY = ['conversations', 'infinite'] as const;

/**
 * Cursor-style paged conversation loader for the in-chat history browser.
 *
 * Server pagination is offset-based; we treat "fewer than a full page came
 * back" as the end-of-data signal, so callers don't need an explicit `hasMore`
 * field from the API. Mirrors the web app's hook.
 */
export function useInfiniteConversations() {
  const { conversationService } = useServices();
  return useInfiniteQuery<Conversation[]>({
    queryKey: INFINITE_KEY,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      conversationService.list({
        limit: DEFAULT_PAGE_SIZE,
        offset: (pageParam as number) * DEFAULT_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < DEFAULT_PAGE_SIZE ? undefined : allPages.length,
    staleTime: 30_000,
  });
}
