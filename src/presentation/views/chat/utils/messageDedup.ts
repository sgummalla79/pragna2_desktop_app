import type { Message } from '@ag-ui/client';

/**
 * Drop an orphaned optimistic user message left in the agent's in-memory list by
 * a prior **failed** run.
 *
 * The chat send path optimistically pushes the user's message into
 * `agent.messages` (with a client-generated id) *before* `runAgent()`. ag-ui then
 * streams that whole list to the backend as the turn's history. A **successful**
 * run is later reconciled to the persisted message log by `ChatSessionView`
 * (which replaces the optimistic copy with the server-id'd one); a **failed** run
 * is not — so its optimistic copy lingers. Without pruning it, every retry
 * appends another copy and the same user message is re-sent N× in the outgoing
 * history (pragna2-tracker #111 — surfaced during the BE investigation of #110,
 * where one message was logged 8× in a single Bedrock request).
 *
 * This removes the single tracked orphan id (and only that id) so exactly one
 * copy of each user message goes out per turn. It is a pure function over the
 * list — the caller decides *when* an orphan exists (i.e. only after a failure)
 * and commits the result back to the agent.
 *
 * @param messages - the agent's current in-memory message list.
 * @param orphanId - id of the prior optimistic push to drop, or `null` when the
 *   previous run did not fail (nothing to prune).
 * @returns a new array with the orphan removed, or the same reference unchanged
 *   when `orphanId` is null or not present.
 */
export function pruneOrphanedOptimisticMessage(
  messages: Message[],
  orphanId: string | null,
): Message[] {
  if (!orphanId) return messages;
  const idx = messages.findIndex((m) => m.id === orphanId);
  if (idx === -1) return messages;
  return [...messages.slice(0, idx), ...messages.slice(idx + 1)];
}
