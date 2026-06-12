import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertDialog, DropdownMenu } from 'radix-ui';
import { Check, MoreVertical, Pencil, Pin, PinOff, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
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

const MENU_ITEM = cn(
  'flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-[13px] outline-none',
  'text-foreground data-[highlighted]:bg-sidebar-hover',
);

const MENU_ITEM_DESTRUCTIVE = cn(
  'flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-[13px] outline-none',
  'text-destructive data-[highlighted]:bg-destructive/10',
);

/**
 * One sidebar row: navigates to the conversation. A 3-dot menu (MoreVertical)
 * appears on hover and exposes Pin/Unpin, Rename, and Delete actions.
 * Delete requires confirmation via an AlertDialog. Rename switches the row
 * to an inline edit form.
 */
export function ConversationListItem({ conversation }: ConversationListItemProps) {
  const navigate = useNavigate();
  const { id: activeId } = useParams();
  const isActive = activeId === conversation.id;

  const rename = useRenameConversation();
  const setPinned = useSetPinned();
  const remove = useDeleteConversation();

  const { data: usage } = useConversationUsage(conversation.id);
  const totalCost = usage ? parseFloat(usage.totalCostUsd) : 0;
  const showCost = totalCost > 0;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conversation.title ?? '');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
    setDeleteOpen(false);
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
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
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
    <>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-lg px-2 h-8 text-[13px] transition-colors',
          isActive
            ? 'font-semibold bg-sidebar-primary text-sidebar-primary-foreground'
            : 'hover:bg-sidebar-hover',
          menuOpen && !isActive && 'bg-sidebar-hover',
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
          {/* Cost chip — fades out when the 3-dot button is visible */}
          {showCost && (
            <span
              className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground opacity-70 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0"
              title={`Total cost so far: ${formatUsd(totalCost)}`}
              aria-label={`Total cost ${formatUsd(totalCost)}`}
            >
              {formatUsd(totalCost)}
            </span>
          )}

          {/* 3-dot menu trigger — visible on hover or while menu is open */}
          <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Conversation options"
                title="Conversation options"
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded transition-opacity',
                  'text-muted-foreground hover:bg-accent hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                )}
              >
                <MoreVertical size={14} aria-hidden />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side="right"
                align="start"
                sideOffset={6}
                className="z-[600] min-w-[160px] rounded-lg border border-border bg-popover p-1 shadow-2xl focus:outline-none"
              >
                {/* Pin / Unpin */}
                <DropdownMenu.Item
                  className={MENU_ITEM}
                  onSelect={togglePin}
                >
                  {conversation.pinned
                    ? <><PinOff size={14} aria-hidden /> Unpin</>
                    : <><Pin size={14} aria-hidden /> Pin</>
                  }
                </DropdownMenu.Item>

                {/* Rename */}
                <DropdownMenu.Item
                  className={MENU_ITEM}
                  onSelect={() => {
                    setDraft(conversation.title ?? '');
                    setEditing(true);
                  }}
                >
                  <Pencil size={14} aria-hidden /> Rename
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="my-1 h-px bg-border" />

                {/* Delete — opens AlertDialog */}
                <DropdownMenu.Item
                  className={MENU_ITEM_DESTRUCTIVE}
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 size={14} aria-hidden /> Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Delete confirmation — outside the row so it survives dropdown close */}
      <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[700] bg-black/50 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[700] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl focus:outline-none">
            <AlertDialog.Title className="text-base font-semibold text-foreground">
              Delete conversation?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-[13px] text-muted-foreground">
              This permanently deletes the conversation and its messages. This can't be undone.
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  className="rounded-lg border border-border px-4 py-2 text-[13px] text-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-lg bg-destructive px-4 py-2 text-[13px] font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  Delete
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
