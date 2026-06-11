import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Pencil, Pin, PinOff, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import { ConfirmButton } from '@/components/ui/confirm-button';
import {
  useDeleteConversation,
  useRenameConversation,
  useSetPinned,
} from '@/presentation/hooks/conversations/useConversationMutations';
import { useConversationUsage } from '@/presentation/hooks/conversations/useConversations';
import { formatUsd } from '@/domain/utils/formatCost';
import { logger } from '@/infrastructure/logging/logger';
import type { Conversation } from '@/domain/types/conversation.types';

interface ConversationListItemProps {
  conversation: Conversation;
}

/** Placeholder title for a conversation whose auto-title hasn't landed yet. */
const UNTITLED = 'New chat';

/**
 * One sidebar row: navigates to the conversation, with hover actions to rename
 * (inline), pin/unpin, and delete (confirmed). Deleting the currently-open
 * conversation navigates back to the chat landing first, so no live observer is
 * left pointing at the deleted id.
 */
export function ConversationListItem({ conversation }: ConversationListItemProps) {
  const navigate = useNavigate();
  const { id: activeId } = useParams();
  const isActive = activeId === conversation.id;

  const rename = useRenameConversation();
  const setPinned = useSetPinned();
  const remove = useDeleteConversation();

  // Running total cost for this conversation. Shown as a quiet chip only when
  // non-zero (a fresh conversation stays clean — no noisy "$0.00"); it fades
  // out on hover/focus so the row actions take the same trailing slot.
  const { data: usage } = useConversationUsage(conversation.id);
  const totalCost = usage ? parseFloat(usage.totalCostUsd) : 0;
  const showCost = totalCost > 0;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conversation.title ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const title = conversation.title?.trim() || UNTITLED;

  const submitRename = (e: FormEvent) => {
    e.preventDefault();
    const next = draft.trim();
    setEditing(false);
    if (!next || next === conversation.title) return;
    rename.mutate(
      { id: conversation.id, title: next },
      { onError: (err) => logger.fromError('CHT_005:rename', err) },
    );
  };

  const togglePin = () => {
    setPinned.mutate(
      { id: conversation.id, pinned: !conversation.pinned },
      { onError: (err) => logger.fromError('CHT_005:pin', err) },
    );
  };

  const handleDelete = async () => {
    // Navigate away BEFORE awaiting delete so this row's observers detach.
    if (isActive) navigate(ROUTES.CHAT);
    try {
      await remove.mutateAsync(conversation.id);
    } catch (err) {
      logger.fromError('CHT_006:delete', err);
    }
  };

  if (editing) {
    return (
      <form onSubmit={submitRename} className="flex items-center gap-1 px-2 py-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
          }}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <button type="submit" aria-label="Save title" className="text-muted-foreground hover:text-foreground">
          <Check size={15} />
        </button>
        <button
          type="button"
          aria-label="Cancel rename"
          onClick={() => setEditing(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X size={15} />
        </button>
      </form>
    );
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-lg px-2 h-8 text-[13px] transition-colors',
        // Selected row matches the settings menu's active style; hover uses the
        // shared --sidebar-hover fill.
        isActive
          ? 'font-semibold bg-sidebar-primary text-sidebar-primary-foreground'
          : 'hover:bg-sidebar-hover',
      )}
    >
      <button
        type="button"
        onClick={() => navigate(`${ROUTES.CHAT}/${conversation.id}`)}
        className="min-w-0 flex-1 truncate text-left"
        title={title}
      >
        {title}
      </button>

      <div className="relative flex shrink-0 items-center">
        {showCost && (
          <span
            className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground opacity-70 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0"
            title={`Total cost so far: ${formatUsd(totalCost)}`}
            aria-label={`Total cost ${formatUsd(totalCost)}`}
          >
            {formatUsd(totalCost)}
          </span>
        )}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={togglePin}
            aria-label={conversation.pinned ? 'Unpin' : 'Pin'}
            title={conversation.pinned ? 'Unpin' : 'Pin'}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {conversation.pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(conversation.title ?? '');
              setEditing(true);
            }}
            aria-label="Rename"
            title="Rename"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil size={14} />
          </button>
          <ConfirmButton
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete conversation"
            title="Delete conversation"
            confirmTitle="Delete conversation?"
            confirmDescription="This permanently deletes the conversation and its messages. This can't be undone."
            confirmLabel="Delete"
            onConfirm={handleDelete}
          >
            <Trash2 size={14} />
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}
