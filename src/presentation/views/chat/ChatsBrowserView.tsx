import { useNavigate } from 'react-router-dom';
import { History } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { ChatsBrowser } from './components/ChatsBrowser';

/**
 * Full-width conversation history browser, rendered at `/chat/history` inside
 * the chat layout: a page header ("Chats" + "New chat") above the shared
 * {@link ChatsBrowser} (search + infinite-scroll list).
 *
 * Faithful port of the web app's `ChatsBrowserView`; the only difference is that
 * "New chat" navigates (route-based shell) rather than toggling a browse mode.
 */
export default function ChatsBrowserView() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-7">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-6 py-8">
        <header className="mb-6 flex shrink-0 items-center justify-between gap-4">
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-foreground">
            <History size={22} aria-hidden className="text-muted-foreground" />
            Chats
          </h1>
          <Button onClick={() => navigate(ROUTES.CHAT)} className="shrink-0">
            New chat
          </Button>
        </header>

        <ChatsBrowser />
      </div>
    </div>
  );
}
