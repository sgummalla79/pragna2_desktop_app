import { useEffect } from 'react';
import type { Message } from '@ag-ui/client';
import type { ChatMessage, ChatStatus } from './useChatSession';

/**
 * Reconcile the in-memory message list back to the persisted (server-fetched)
 * snapshot once a run settles.
 *
 * A tool-using turn (e.g. create_pdf) or a buffered episode/attach stream
 * leaves the final-assistant message with its LangChain stream id; per-message
 * lookups keyed on BE UUIDs (attachments, model attribution) miss until a
 * manual reload. Swapping to the persisted list fixes that.
 *
 * Guards that prevent incorrect replacement:
 * 1. Never replace while a run is in flight (`status === 'running'`).
 * 2. Never replace when in-memory count exceeds persisted count — the persisted
 *    snapshot is stale (either an optimistic user message pre-run, or a just-
 *    completed turn whose /messages refetch hasn't resolved yet). Wiping in
 *    either window removes content the user can see (CF-013 / CF-013b).
 * 3. Skip when either list is empty (nothing to reconcile).
 *
 * @param status       Current run status from {@link useChatSession}.
 * @param messages     In-memory (React state) message list.
 * @param persisted    Server-persisted message list.
 * @param initialMessages  The persisted list converted to AG-UI seed shape.
 * @param replaceMessages  Callback that replaces the agent's message list.
 */
export function useReconcileMessages(
  status: ChatStatus,
  messages: ChatMessage[],
  persisted: { id: string }[],
  initialMessages: Message[],
  replaceMessages: (msgs: Message[]) => void,
): void {
  useEffect(() => {
    if (status === 'running') return;
    if (messages.length === 0) return;
    if (persisted.length === 0) return;

    const lastInMemory = messages[messages.length - 1];
    const lastPersisted = persisted[persisted.length - 1];

    // CF-013 / CF-013b: in-memory is ahead of persisted — either an optimistic
    // user message (pre-run, status='idle') or a just-completed turn whose
    // /messages refetch hasn't resolved yet (post-run, status='idle' again).
    // In both cases the persisted snapshot is stale; wait for it to catch up.
    if (messages.length > persisted.length) return;

    if (persisted.length !== messages.length || lastInMemory.id !== lastPersisted.id) {
      replaceMessages(initialMessages);
    }
  }, [persisted, messages, status, initialMessages, replaceMessages]);
}
