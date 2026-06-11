import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { PanelLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SIDEBAR_BOX_INSET_PX,
  SIDEBAR_BOX_GAP_PX,
  SIDEBAR_TITLE_ROW_PX,
  TITLEBAR_TOGGLE_LEFT_PX,
  TITLEBAR_TOGGLE_Y_NUDGE_PX,
  TOGGLE_ICON_PX,
  TRAFFIC_LIGHT_Y,
} from '@/constants/windowChrome';
import { ChatSidebar } from './components/ChatSidebar';

/**
 * Chat shell: a conversation sidebar + the active conversation (`<Outlet/>`).
 *
 * Responsive by design:
 *  - `md` and up: an inset, rounded sidebar "box" beside the content (the macOS
 *    traffic lights are inset to sit inside its top-left title row — see
 *    `@/constants/windowChrome`).
 *  - below `md`: the rail is hidden; a hamburger (right of the traffic lights)
 *    opens the sidebar as an overlay drawer that closes on backdrop tap or
 *    navigation.
 *
 * Box/title-row geometry comes from `@/constants/windowChrome`; theme tokens only.
 */
export function ChatView() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Desktop rail, as an inset rounded box. */}
      <aside
        className={cn(
          'hidden md:flex w-[260px] min-w-[260px] flex-shrink-0 flex-col overflow-hidden rounded-md',
          'border border-border bg-sidebar text-sidebar-foreground shadow-sm',
        )}
        style={{
          marginTop: SIDEBAR_BOX_INSET_PX,
          marginBottom: SIDEBAR_BOX_INSET_PX,
          marginLeft: SIDEBAR_BOX_INSET_PX,
          marginRight: SIDEBAR_BOX_GAP_PX,
          height: `calc(100vh - ${SIDEBAR_BOX_INSET_PX * 2}px)`,
          paddingTop: SIDEBAR_TITLE_ROW_PX,
        }}
      >
        <ChatSidebar />
      </aside>

      {/* Mobile drawer toggle — sits right of the traffic lights. */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open conversations"
        className="md:hidden fixed z-[70] flex h-6 w-6 items-center justify-center rounded text-foreground/70 hover:bg-accent hover:text-foreground"
        // Centered on the (inset) traffic lights' vertical center, with a fine nudge.
        style={{
          left: TITLEBAR_TOGGLE_LEFT_PX,
          top: TRAFFIC_LIGHT_Y + TITLEBAR_TOGGLE_Y_NUDGE_PX,
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
