import { useMemo } from 'react';
import {
  useConversations,
  usePinnedConversations,
} from '@/presentation/hooks/conversations/useConversations';
import { ConversationListItem } from './ConversationListItem';

/**
 * Sidebar conversation list: a "Pinned" group (when any) followed by recent
 * conversations. The recent query returns all conversations newest-first, so
 * pinned rows are filtered out of it to avoid showing them twice.
 */
export function ConversationList() {
  const { data: pinned = [], isLoading: pinnedLoading } = usePinnedConversations();
  const { data: recent = [], isLoading: recentLoading } = useConversations(0);

  const pinnedIds = useMemo(() => new Set(pinned.map((c) => c.id)), [pinned]);
  const recentUnpinned = useMemo(
    () => recent.filter((c) => !pinnedIds.has(c.id)),
    [recent, pinnedIds],
  );

  if (pinnedLoading && recentLoading) {
    return <p className="px-2 py-4 text-[13px] text-muted-foreground">Loading…</p>;
  }

  if (pinned.length === 0 && recentUnpinned.length === 0) {
    return (
      <p className="px-2 py-4 text-[13px] text-muted-foreground">
        No conversations yet. Start a new chat.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {pinned.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pinned
          </p>
          {pinned.map((c) => (
            <ConversationListItem key={c.id} conversation={c} />
          ))}
        </div>
      )}
      {recentUnpinned.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {pinned.length > 0 && (
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Recent
            </p>
          )}
          {recentUnpinned.map((c) => (
            <ConversationListItem key={c.id} conversation={c} />
          ))}
        </div>
      )}
    </div>
  );
}
