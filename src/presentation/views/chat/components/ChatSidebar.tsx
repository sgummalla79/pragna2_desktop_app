import { useNavigate } from 'react-router-dom';
import { Plus, History } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { ConversationList } from './ConversationList';
import { AvatarMenu } from './AvatarMenu';

interface ChatSidebarProps {
  /** Called after a navigation action (used to close the mobile drawer). */
  onNavigate?: () => void;
}

/**
 * Chat sidebar panel content: a "New chat" button, the conversation list, and
 * the account / settings {@link AvatarMenu} at the bottom. Positioning (desktop
 * rail vs mobile drawer) is owned by {@link ChatView}; this component is
 * layout-agnostic.
 */
export function ChatSidebar({ onNavigate }: ChatSidebarProps) {
  const navigate = useNavigate();

  const go = (to: string) => {
    navigate(to);
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-1 px-3 pb-2">
        <button
          type="button"
          onClick={() => go(ROUTES.CHAT)}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Plus size={16} aria-hidden />
          New chat
        </button>
        <button
          type="button"
          onClick={() => go(ROUTES.CHAT_HISTORY)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <History size={16} aria-hidden />
          All chats
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        <ConversationList />
      </div>

      <div className="border-t border-border px-3 py-2">
        <AvatarMenu onNavigate={onNavigate} />
      </div>
    </div>
  );
}
