import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { PanelLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatSidebar } from './components/ChatSidebar';

/**
 * Chat shell: a conversation sidebar + the active conversation (`<Outlet/>`).
 *
 * Responsive by design:
 *  - `md` and up: a fixed 260px sidebar rail beside the content.
 *  - below `md`: the rail is hidden; a hamburger (top-left, clear of the macOS
 *    traffic lights) opens the sidebar as an overlay drawer that closes on
 *    backdrop tap or navigation.
 *
 * `pt-7` on the panels clears the overlay title bar. Theme tokens only.
 */
export function ChatView() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Desktop rail. */}
      <aside className="hidden md:flex w-[260px] min-w-[260px] flex-col border-r border-border bg-sidebar pt-7 text-sidebar-foreground">
        <ChatSidebar />
      </aside>

      {/* Mobile drawer toggle — sits right of the traffic lights. */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open conversations"
        className="md:hidden fixed left-[78px] top-1 z-[70] flex h-6 w-6 items-center justify-center rounded text-foreground/70 hover:bg-accent hover:text-foreground"
      >
        <PanelLeft size={16} aria-hidden />
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
              'border-r border-border bg-sidebar pt-7 text-sidebar-foreground shadow-2xl',
            )}
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
