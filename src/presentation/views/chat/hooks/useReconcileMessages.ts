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
 * 2. Never replace while `reconcileBlocked` is set — a raw episode/delegation
 *    resume (`runEpisodeStream`) flips `status` to `'idle'` in its `finally`
 *    BEFORE its `/messages` refetch resolves. In that window `persisted` is a
 *    stale snapshot from a prior turn; replacing against it wipes the just-
 *    completed delegation turn with an old seed and the BE then re-processes
 *    the same user message → a duplicate reply (CF-029 / pragna2-tracker #158).
 *    The flag stays set until the refetch lands, closing the window the
 *    `status`/count guards (3) leave open when the stale persisted snapshot
 *    happens to have the same count but a different last id.
 * 3. Never replace when in-memory count exceeds persisted count — the persisted
 *    snapshot is normally stale (either an optimistic user message pre-run, or a
 *    just-completed turn whose /messages refetch hasn't resolved yet). Wiping in
 *    either window removes content the user can see (CF-013 / CF-013b). The ONE
 *    safe exception is a collapsed tool turn (see {@link isCollapsedToolTurn}).
 * 4. Skip when either list is empty (nothing to reconcile).
 *
 * @param status       Current run status from {@link useChatSession}.
 * @param messages     In-memory (React state) message list.
 * @param persisted    Server-persisted message list (id + role + content; role
 *   and content drive the collapsed-tool-turn exception to guard 3).
 * @param initialMessages  The persisted list converted to AG-UI seed shape.
 * @param replaceMessages  Callback that replaces the agent's message list.
 * @param reconcileBlocked  True while a raw episode/delegation resume is settling
 *   its `/messages` refetch; suppresses replacement against a stale snapshot.
 */
export function useReconcileMessages(
  status: ChatStatus,
  messages: ChatMessage[],
  persisted: ReconcilePersisted[],
  initialMessages: Message[],
  replaceMessages: (msgs: Message[]) => void,
  reconcileBlocked = false,
): void {
  useEffect(() => {
    if (reconcileBlocked) return;
    if (status === 'running') return;
    if (messages.length === 0) return;
    if (persisted.length === 0) return;

    const lastInMemory = messages[messages.length - 1];
    const lastPersisted = persisted[persisted.length - 1];

    // CF-013 / CF-013b: in-memory ahead of persisted normally means the persisted
    // snapshot is stale — an optimistic user message (pre-run) or a just-completed
    // turn whose /messages refetch hasn't resolved yet (post-run). Wait for it to
    // catch up rather than wipe content the user can see.
    //
    // EXCEPTION — a collapsed tool turn (e.g. create_pdf): the agent streams
    // intermediate tool-call/result messages that the BE persists as a SINGLE
    // assistant message, so a SETTLED turn legitimately ends with fewer persisted
    // than in-memory messages and would otherwise never reconcile — leaving the
    // persisted-only attachment (DocumentCard) invisible until a manual reload.
    // Safe to reconcile ONLY when the persisted tail is the SAME final assistant
    // turn as the in-memory tail (matched by content): a stale snapshot's tail is
    // an OLDER turn whose content differs, so CF-013b stays guarded even if that
    // older turn carried its own attachment.
    if (messages.length > persisted.length && !isCollapsedToolTurn(lastInMemory, lastPersisted)) {
      return;
    }

    if (persisted.length !== messages.length || lastInMemory.id !== lastPersisted.id) {
      replaceMessages(initialMessages);
    }
  }, [persisted, messages, status, initialMessages, replaceMessages, reconcileBlocked]);
}

/** The persisted-message shape this hook needs: a BE id plus the role/content
 *  used to detect the collapsed-tool-turn exception to the stale-snapshot guard. */
export interface ReconcilePersisted {
  id: string;
  role?: string;
  content?: string;
}

/** Whitespace-normalised text, for tolerant streamed-vs-persisted comparison. */
function normalizeText(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * True when the in-memory tail and persisted tail are the SAME final assistant
 * turn — the signal that an `in-memory > persisted` gap is a collapsed tool turn
 * (BE merged intermediate tool messages) rather than a stale snapshot.
 *
 * Both tails must be assistant messages whose (whitespace-normalised) text
 * matches — equal, or one a prefix of the other to tolerate a trailing chunk the
 * stream hadn't flushed. Empty text never matches, so a stale snapshot whose tail
 * is an OLDER, different-content assistant turn (CF-013b) is NOT mistaken for the
 * just-finished turn — including the back-to-back attachment-turn case.
 */
function isCollapsedToolTurn(
  lastInMemory: ChatMessage,
  lastPersisted: ReconcilePersisted,
): boolean {
  if (lastInMemory.role !== 'assistant' || lastPersisted.role !== 'assistant') return false;
  const inMem = normalizeText(lastInMemory.content);
  const persisted = normalizeText(lastPersisted.content);
  if (inMem === '' || persisted === '') return false;
  return inMem === persisted || persisted.startsWith(inMem) || inMem.startsWith(persisted);
}
