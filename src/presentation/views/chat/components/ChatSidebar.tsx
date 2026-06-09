import { useNavigate } from 'react-router-dom';
import { Plus, Settings } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { ConversationList } from './ConversationList';

interface ChatSidebarProps {
  /** Called after a navigation action (used to close the mobile drawer). */
  onNavigate?: () => void;
}

/**
 * Chat sidebar panel content: a "New chat" button, the conversation list, and
 * a "Settings" link at the bottom. Positioning (desktop rail vs mobile drawer)
 * is owned by {@link ChatView}; this component is layout-agnostic.
 */
export function ChatSidebar({ onNavigate }: ChatSidebarProps) {
  const navigate = useNavigate();

  const go = (to: string) => {
    navigate(to);
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => go(ROUTES.CHAT)}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Plus size={16} aria-hidden />
          New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        <ConversationList />
      </div>

      <div className="border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={() => go(ROUTES.SETTINGS)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Settings size={16} aria-hidden />
          Settings
        </button>
      </div>
    </div>
  );
}
