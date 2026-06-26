import type { Message } from '@ag-ui/client';

/**
 * Truncate the agent's in-memory message list at a message id — drop the message
 * with that id **and everything after it** — mirroring the backend
 * `messages/truncate-from` deletion.
 *
 * Why this exists (nexus-kit-tracker #230 — edit/regenerate orphaned tool_call):
 * editing a user message (or regenerating an assistant turn) first calls the
 * backend `truncate-from` to delete that message and its successors from the
 * persisted log, then re-sends. But the truncate only touches the server — the
 * agent's in-memory `agent.messages` still holds the deleted turn. ag-ui streams
 * that whole in-memory list to the backend as the turn's history, so the deleted
 * turn is re-sent.
 *
 * When the deleted turn was a collapsed tool turn (e.g. `create_pdf`), the seed
 * carries the assistant message's `tool_calls` but **no paired `role:'tool'`
 * result** (the BE persists such a turn as a single assistant message — see
 * `useReconcileMessages.isCollapsedToolTurn`). The provider then rejects the
 * request: an assistant message with `tool_calls` must be followed by tool
 * messages answering each `tool_call_id` (OpenAI 400 `invalid_request_error`),
 * surfacing in the UI as "The response could not be completed…".
 *
 * Pruning the in-memory list to match the server truncation removes the orphaned
 * assistant tool-call from the outgoing history, restoring the invariant that the
 * in-memory history mirrors the persisted log before a re-send. Pure function:
 * the caller decides *when* to truncate (only after the server truncate succeeds)
 * and commits the result back to the agent.
 *
 * @param messages - the agent's current in-memory message list.
 * @param messageId - id of the first message to drop; it and all later messages
 *   are removed.
 * @returns a new array truncated before `messageId`, or the same reference
 *   unchanged when `messageId` is not present (nothing to truncate).
 */
export function truncateMessagesFrom(
  messages: Message[],
  messageId: string,
): Message[] {
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return messages;
  return messages.slice(0, idx);
}
