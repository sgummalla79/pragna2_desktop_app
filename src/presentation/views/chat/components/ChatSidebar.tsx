import { useNavigate, useMatch } from 'react-router-dom';
import { Plus, MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import { APP_NAME } from '@/constants/api';
import PragnaLogo from '@/assets/logo.svg?react';
import { ConversationList } from './ConversationList';
import { AvatarMenu } from './AvatarMenu';

interface ChatSidebarProps {
  /** Called after a navigation action (used to close the mobile drawer). */
  onNavigate?: () => void;
}

/**
 * Chat sidebar panel content: app branding header, "New Chat" button, "Chats"
 * nav item, the conversation list, and the account / settings {@link AvatarMenu}
 * at the bottom. Positioning (desktop rail vs mobile drawer) is owned by
 * {@link ChatView}; this component is layout-agnostic.
 */
export function ChatSidebar({ onNavigate }: ChatSidebarProps) {
  const navigate = useNavigate();
  const onChats = useMatch(ROUTES.CHAT_HISTORY);

  const go = (to: string) => {
    navigate(to);
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── App header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 pb-3">
        <PragnaLogo className="h-6 w-6 shrink-0 text-foreground" aria-hidden />
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          {APP_NAME}
        </span>
      </div>

      {/* ── Actions ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 px-3 pb-2">
        <button
          type="button"
          onClick={() => go(ROUTES.CHAT)}
          className="flex w-full items-center gap-2 rounded-lg px-2 h-8 text-[13px] text-foreground/80 transition-colors hover:bg-sidebar-hover hover:text-foreground"
        >
          <Plus size={16} aria-hidden />
          New Chat
        </button>

        <button
          type="button"
          onClick={() => go(ROUTES.CHAT_HISTORY)}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2 h-8 text-[13px] transition-colors',
            onChats
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-foreground/80 hover:bg-sidebar-hover hover:text-foreground',
          )}
        >
          <MessagesSquare size={16} aria-hidden />
          Chats
        </button>
      </div>

      {/* ── Conversation list ───────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        <ConversationList />
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div className="px-3 py-1">
        <AvatarMenu onNavigate={onNavigate} />
      </div>
    </div>
  );
}
