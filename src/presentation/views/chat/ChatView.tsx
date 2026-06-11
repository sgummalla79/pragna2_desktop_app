import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { PanelLeft, PanelLeftOpen, Plus, MessagesSquare, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SIDEBAR_BOX_INSET_PX,
  SIDEBAR_BOX_GAP_PX,
  SIDEBAR_TITLE_ROW_PX,
  CHAT_SIDEBAR_WIDTH_PX,
  TITLEBAR_TOGGLE_LEFT_PX,
  TITLEBAR_SEARCH_LEFT_PX,
  TITLEBAR_ACTION_TOP_PX,
  TOGGLE_ICON_PX,
} from '@/constants/windowChrome';
import { TitlebarCollapseToggle } from '@/components/ui/sidebar/TitlebarCollapseToggle';
import { isWindowsPlatform } from '@/infrastructure/platform';
import { useUiStore } from '@/presentation/store/uiStore';
import { ROUTES } from '@/constants/routes';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatsSearchModal } from './components/ChatsSearchModal';
import { AvatarMenu } from './components/AvatarMenu';

/**
 * Chat shell: a conversation sidebar + the active conversation (`<Outlet/>`).
 *
 * Responsive by design:
 *  - `md` and up: an inset, rounded sidebar "box" beside the content. A collapse
 *    toggle hides the rail. On macOS it floats in the title bar next to the
 *    traffic lights ({@link TitlebarCollapseToggle}); on Windows it is inlined
 *    in the sidebar header row. The choice is persisted.
 *  - below `md`: the rail is hidden; a hamburger (right of the traffic lights)
 *    opens the sidebar as an overlay drawer that closes on backdrop tap or
 *    navigation.
 *
 * Platform-conditional UI (via {@link isWindowsPlatform}):
 *  - **macOS**: overlay {@link TitlebarCollapseToggle} + search button in title bar.
 *  - **Windows**: inline collapse toggle inside the sidebar header; no search button.
 *
 * Box/title-row geometry comes from `@/constants/windowChrome`; theme tokens only.
 */
export function ChatView() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const collapsed = useUiStore((s) => s.chatPaneCollapsed);
  const toggleCollapsed = useUiStore((s) => s.toggleChatPane);
  const isWindows = isWindowsPlatform();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* macOS only: floating collapse toggle next to the traffic lights.
          Hidden on Windows (the toggle lives inside the sidebar header there)
          and hidden below md (mobile uses the drawer hamburger instead). */}
      {!isWindows && (
        <div className="hidden md:block">
          <TitlebarCollapseToggle
            collapsed={collapsed}
            onToggle={toggleCollapsed}
            openLabel="Open conversations"
            collapseLabel="Collapse conversations"
            flyout={
              <div className="h-[70vh]">
                <ChatSidebar />
              </div>
            }
          />
        </div>
      )}

      {/* macOS only: search button in the title-bar strip.
          Windows has no title-bar search icon. */}
      {!isWindows && (
        <>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search chats"
            title="Search chats"
            className="fixed z-[70] flex h-6 w-6 items-center justify-center rounded text-foreground/70 hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{
              left: TITLEBAR_SEARCH_LEFT_PX,
              top: TITLEBAR_ACTION_TOP_PX,
              transform: 'translateY(-50%)',
            }}
          >
            <Search size={TOGGLE_ICON_PX} aria-hidden />
          </button>

          <ChatsSearchModal open={searchOpen} onOpenChange={setSearchOpen} />
        </>
      )}

      {/* Desktop rail, as an inset rounded box. Hidden when collapsed. */}
      {!collapsed && (
        <aside
          className={cn(
            'hidden md:flex flex-shrink-0 flex-col overflow-hidden rounded-md',
            'border border-border bg-sidebar text-sidebar-foreground shadow-sm',
          )}
          style={{
            width: CHAT_SIDEBAR_WIDTH_PX,
            minWidth: CHAT_SIDEBAR_WIDTH_PX,
            marginTop: SIDEBAR_BOX_INSET_PX,
            marginBottom: SIDEBAR_BOX_INSET_PX,
            marginLeft: SIDEBAR_BOX_INSET_PX,
            marginRight: SIDEBAR_BOX_GAP_PX,
            height: `calc(100vh - ${SIDEBAR_BOX_INSET_PX * 2}px)`,
            paddingTop: isWindows ? 0 : SIDEBAR_TITLE_ROW_PX,
          }}
        >
          <ChatSidebar
            collapsed={isWindows ? collapsed : undefined}
            onToggleCollapsed={isWindows ? toggleCollapsed : undefined}
          />
        </aside>
      )}

      {/* Windows collapsed state: narrow icon-only rail with expand + action icons. */}
      {isWindows && collapsed && (
        <aside
          className={cn(
            'hidden md:flex flex-shrink-0 flex-col items-center overflow-hidden rounded-md',
            'border border-border bg-sidebar text-sidebar-foreground shadow-sm',
          )}
          style={{
            width: 48,
            minWidth: 48,
            marginTop: SIDEBAR_BOX_INSET_PX,
            marginBottom: SIDEBAR_BOX_INSET_PX,
            marginLeft: SIDEBAR_BOX_INSET_PX,
            marginRight: SIDEBAR_BOX_GAP_PX,
            height: `calc(100vh - ${SIDEBAR_BOX_INSET_PX * 2}px)`,
            paddingTop: 16,
          }}
        >
          {/* Expand icon */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Expand conversations"
            title="Expand conversations"
            className="mb-2 flex h-8 w-8 items-center justify-center rounded text-foreground/60 hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PanelLeftOpen size={16} aria-hidden />
          </button>

          {/* New Chat */}
          <button
            type="button"
            onClick={() => navigate(ROUTES.CHAT)}
            aria-label="New Chat"
            title="New Chat"
            className="mb-1 flex h-8 w-8 items-center justify-center rounded text-foreground/60 hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={16} aria-hidden />
          </button>

          {/* Chats */}
          <button
            type="button"
            onClick={() => navigate(ROUTES.CHAT_HISTORY)}
            aria-label="Chats"
            title="Chats"
            className="flex h-8 w-8 items-center justify-center rounded text-foreground/60 hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MessagesSquare size={16} aria-hidden />
          </button>

          {/* Avatar — pinned to the bottom, icon only */}
          <div className="mt-auto pb-2">
            <AvatarMenu iconOnly />
          </div>
        </aside>
      )}

      {/* Mobile drawer toggle — sits right of the traffic lights. */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open conversations"
        className="md:hidden fixed z-[70] flex h-6 w-6 items-center justify-center rounded text-foreground/70 hover:bg-accent hover:text-foreground"
        style={{
          left: TITLEBAR_TOGGLE_LEFT_PX,
          top: TITLEBAR_ACTION_TOP_PX,
          transform: 'translateY(-50%)',
        }}
      >
        <PanelLeft size={TOGGLE_ICON_PX} aria-hidden />
      </button>

      {/* Mobile drawer + backdrop. */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-[80]">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside
            className={cn(
              'absolute left-0 top-0 h-full w-[280px] max-w-[85vw] flex flex-col',
              'border-r border-border bg-sidebar text-sidebar-foreground shadow-2xl',
            )}
            style={{ paddingTop: SIDEBAR_TITLE_ROW_PX }}
          >
            <div className="flex justify-end px-2 pb-1">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close conversations"
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <ChatSidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export default ChatView;
