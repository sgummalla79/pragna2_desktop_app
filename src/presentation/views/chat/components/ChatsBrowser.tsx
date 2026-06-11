import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Search } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Input } from '@/components/ui/input';
import { relativeTime } from '@/domain/utils/relativeTime';
import { useInfiniteConversations } from '@/presentation/hooks/conversations/useInfiniteConversations';

interface ChatsBrowserProps {
  /**
   * Called after a conversation row is chosen. Lets a host that renders this in
   * an overlay (e.g. the title-bar search modal) dismiss itself on navigation.
   * The full-page route view omits it — navigation already replaces the page.
   */
  onSelect?: () => void;
  /** Autofocus the search box on mount (used by the modal). */
  autoFocusSearch?: boolean;
}

/**
 * Conversation browse UI shared by the full-page `/chat/history` view and the
 * title-bar search modal: a title-only client-side search over what's loaded
 * plus infinite-scroll rows (title + relative timestamp), with an
 * IntersectionObserver sentinel requesting the next page as the user scrolls.
 *
 * Layout-agnostic — it fills its parent (`min-h-0` column); the host owns the
 * surrounding chrome (page header / dialog frame) and scroll container sizing.
 */
export function ChatsBrowser({ onSelect, autoFocusSearch = false }: ChatsBrowserProps) {
  const [query, setQuery] = useState('');
  const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteConversations();

  const conversations = useMemo(() => data?.pages.flat() ?? [], [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.title ?? 'Untitled chat').toLowerCase().includes(q));
  }, [conversations, query]);

  // IntersectionObserver sentinel — load the next page as it scrolls into view.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasNextPage) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative mb-2 shrink-0">
        <Search
          size={18}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats…"
          aria-label="Search chats"
          autoFocus={autoFocusSearch}
          className="h-12 pl-11 text-[15px]"
        />
      </div>

      {isLoading ? (
        <p className="py-6 text-sm text-muted-foreground">Loading conversations…</p>
      ) : isError ? (
        <p className="py-6 text-sm text-destructive">Couldn&rsquo;t load conversations.</p>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <History size={40} className="mx-auto mb-3 opacity-30" aria-hidden />
          <p>
            {query.trim()
              ? `No chats match "${query.trim()}".`
              : 'No conversations yet. Start chatting!'}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul className="m-0 flex list-none flex-col p-0" role="list">
            {filtered.map((c) => (
              <li key={c.id} className="border-b border-border/50">
                <Link
                  to={`${ROUTES.CHAT}/${c.id}`}
                  onClick={() => onSelect?.()}
                  className="group flex items-baseline gap-3 px-1 py-4 no-underline transition-colors hover:bg-accent/40"
                  title={c.title ?? 'Untitled chat'}
                >
                  <span className="min-w-0 flex-1 truncate text-[15px] text-foreground">
                    {c.title?.trim() || 'Untitled chat'}
                  </span>
                  <span className="shrink-0 text-[13px] text-muted-foreground">
                    {relativeTime(c.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div ref={sentinelRef} aria-hidden className="h-px w-full" />
          {isFetchingNextPage && (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading more…</p>
          )}
        </div>
      )}
    </div>
  );
}
