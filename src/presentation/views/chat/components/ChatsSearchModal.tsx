import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatsBrowser } from './ChatsBrowser';

interface ChatsSearchModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** Open-state change handler (backdrop click, Esc, close button). */
  onOpenChange: (open: boolean) => void;
}

/**
 * Title-bar "all chats" search popup: the shared {@link ChatsBrowser} (search +
 * infinite-scroll list) inside a centered dialog. Opened from the search button
 * beside the chat sidebar's collapse toggle; selecting a conversation navigates
 * and dismisses the modal.
 */
export function ChatsSearchModal({ open, onOpenChange }: ChatsSearchModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[70vh] max-h-[70vh] w-full flex-col gap-3 sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>All chats</DialogTitle>
        </DialogHeader>
        <ChatsBrowser autoFocusSearch onSelect={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
