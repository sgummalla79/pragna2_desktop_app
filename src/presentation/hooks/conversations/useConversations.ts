import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';

const CONVERSATIONS_KEY = (page: number) => ['conversations', page] as const;
const PINNED_KEY = ['conversations', 'pinned'] as const;

/**
 * Invalidate ONLY the sidebar list queries (and optionally one specific
 * conversation's `single` lookup) — NEVER the per-conversation `messages`
 * subtree.
 *
 * A broad `invalidateQueries({ queryKey: ['conversations'] })` prefix-matches
 * every per-conversation subquery for every cached conversation, firing a
 * cascade of refetches on a single list change. This narrow predicate matches:
 *   - sidebar list pages: `['conversations', <pageNumber>]`
 *   - pinned list: `['conversations', 'pinned']`
 *   - (optional) the named conversation's single-lookup (chat header title):
 *     `['conversations', <id>, 'single']`
 */
export function invalidateConversationListQueries(
  qc: QueryClient,
  options: { conversationId?: string } = {},
): void {
  const targetId = options.conversationId;
  qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey;
      if (!Array.isArray(k) || k[0] !== 'conversations') return false;
      if (k.length === 2 && typeof k[1] === 'number') return true; // list pages
      if (k.length === 2 && k[1] === 'pinned') return true; // pinned list
      if (targetId && k.length === 3 && k[1] === targetId && k[2] === 'single') {
        return true; // chat-header single-lookup
      }
      return false;
    },
  });
}

/** Page of the user's conversations (newest first) for the sidebar list. */
export function useConversations(page = 0) {
  const { conversationService } = useServices();
  return useQuery({
    queryKey: CONVERSATIONS_KEY(page),
    queryFn: () =>
      conversationService.list({
        limit: DEFAULT_PAGE_SIZE,
        offset: page * DEFAULT_PAGE_SIZE,
      }),
    // Mutations that change the list (auto-title, pin/unpin, delete, new turn)
    // invalidate this key explicitly; 30s matches the other list hooks.
    staleTime: 30_000,
  });
}

/** Pinned conversations only — the sidebar's "Pinned" group (no pagination). */
export function usePinnedConversations() {
  const { conversationService } = useServices();
  return useQuery({
    queryKey: PINNED_KEY,
    queryFn: () =>
      conversationService.list({
        limit: DEFAULT_PAGE_SIZE,
        offset: 0,
        pinned: true,
      }),
    staleTime: 30_000,
  });
}
