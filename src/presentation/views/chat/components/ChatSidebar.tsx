import { useNavigate, useMatch } from 'react-router-dom';
import { Plus, MessagesSquare, PanelLeft, PanelLeftClose } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import { APP_NAME } from '@/constants/api';
import { isWindowsPlatform } from '@/infrastructure/platform';
import PragnaLogo from '@/assets/logo.svg?react';
import { ConversationList } from './ConversationList';
import { AvatarMenu } from './AvatarMenu';

interface ChatSidebarProps {
  /** Called after a navigation action (used to close the mobile drawer). */
  onNavigate?: () => void;
  /**
   * Windows-only: current collapsed state of the sidebar rail.
   * When provided, the inline collapse toggle is rendered in the header row.
   */
  collapsed?: boolean;
  /** Windows-only: toggle callback paired with {@link collapsed}. */
  onToggleCollapsed?: () => void;
}

/**
 * Chat sidebar panel content.
 *
 * Platform differences (governed by {@link isWindowsPlatform}):
 *  - **Windows**: renders the app logo + name header, an inline collapse toggle
 *    in that header row, and the "Chats" nav item.
 *  - **macOS**: renders none of those (the macOS window uses the OS title bar
 *    chrome + {@link TitlebarCollapseToggle} in the main ChatView overlay).
 *
 * Positioning (desktop rail vs mobile drawer) is owned by {@link ChatView};
 * this component is layout-agnostic.
 */
export function ChatSidebar({ onNavigate, collapsed, onToggleCollapsed }: ChatSidebarProps) {
  const navigate = useNavigate();
  const onChats = useMatch(ROUTES.CHAT_HISTORY);
  const isWindows = isWindowsPlatform();

  const go = (to: string) => {
    navigate(to);
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── App header (Windows only) ───────────────────────────── */}
      {isWindows && (
        <>
          {/* Row 1: empty spacer — 16px top padding below the title bar. */}
          <div className="h-4 shrink-0" aria-hidden />

          {/* Row 2: [Logo + Brand name] on left, [Collapse toggle] on right. */}
          <div className="flex items-center px-3 pb-3">
            <PragnaLogo className="h-6 w-6 shrink-0 text-foreground" aria-hidden />
            <span className="ml-2 text-[15px] font-semibold tracking-tight text-foreground">
              {APP_NAME}
            </span>

            {/* Collapse toggle — rightmost in the header row */}
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label={collapsed ? 'Expand conversations' : 'Collapse conversations'}
                title={collapsed ? 'Expand conversations' : 'Collapse conversations'}
                className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded text-foreground/60 hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {collapsed ? (
                  <PanelLeft size={14} aria-hidden />
                ) : (
                  <PanelLeftClose size={14} aria-hidden />
                )}
              </button>
            )}
          </div>
        </>
      )}

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

        {/* Chats nav item — Windows only */}
        {isWindows && (
          <button
            type="button"
            onClick={() => go(ROUTES.CHAT_HISTORY)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2 h-8 text-[13px] transition-colors mb-8',
              onChats
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-foreground/80 hover:bg-sidebar-hover hover:text-foreground',
            )}
          >
            <MessagesSquare size={16} aria-hidden />
            Chats
          </button>
        )}
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
