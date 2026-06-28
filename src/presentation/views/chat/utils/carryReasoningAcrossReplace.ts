import type { Message } from '@ag-ui/client';

/**
 * Whitespace-normalised assistant text, used to pair a streamed (stream-id)
 * message with its persisted (BE-UUID) counterpart. Mirrors the tolerant
 * comparison in `useReconcileMessages.normalizeText`.
 */
function normalizeContent(content: Message['content']): string {
  return (typeof content === 'string' ? content : '').replace(/\s+/g, ' ').trim();
}

/**
 * Re-key live reasoning traces from streamed assistant messages onto their
 * persisted counterparts before a settle-time reconcile swaps the in-memory
 * list for the server snapshot.
 *
 * Reasoning is streamed via `reasoning_content` and stored in
 * `reasoningByMessageId` keyed by the LangChain **stream id** of the in-flight
 * assistant message. On run settle, `replaceMessages` swaps that message for the
 * persisted one, which carries a different **BE UUID** id and no reasoning — so
 * the per-id lookup in `toChatMessage` misses and the thinking trace vanishes
 * the instant the answer settles (nexus-kit-tracker #221 / CODE_FIXES CF-044;
 * regressed by commit `4e9cc9a` which added the reconcile-on-settle effect).
 *
 * This bridges the gap: for every replacement assistant message that lacks its
 * own trace, find a `prev` assistant message that DOES have one and whose
 * whitespace-normalised content matches, and copy the trace onto the
 * replacement id. The map is mutated in place (the same ref `toChatMessage`
 * reads), so the swapped-in persisted message renders its trace unchanged.
 *
 * Pairing rules:
 * - Only assistant messages are considered (reasoning is an assistant concern).
 * - Empty/whitespace content never matches — a blank turn can't be paired by
 *   content, so two contentless assistant turns are never cross-wired.
 * - A replacement id that already has a trace is left untouched (idempotent;
 *   covers the case where the stream id and BE id happen to coincide).
 * - First stream-side trace wins per content key, so a later identical-content
 *   turn does not overwrite an earlier mapping.
 *
 * @param prev                 In-memory messages BEFORE the swap (stream ids).
 * @param replacement          Persisted messages being swapped in (BE UUIDs).
 * @param reasoningByMessageId Live trace map (mutated in place).
 */
export function carryReasoningAcrossReplace(
  prev: Message[],
  replacement: Message[],
  reasoningByMessageId: Map<string, string>,
): void {
  if (reasoningByMessageId.size === 0) return;

  // Stream-side: normalised content -> reasoning, for assistant messages that
  // actually carry a live trace.
  const traceByContent = new Map<string, string>();
  for (const m of prev) {
    if (m.role !== 'assistant') continue;
    const trace = reasoningByMessageId.get(m.id);
    if (!trace) continue;
    const key = normalizeContent(m.content);
    if (key === '') continue;
    if (!traceByContent.has(key)) traceByContent.set(key, trace);
  }
  if (traceByContent.size === 0) return;

  for (const m of replacement) {
    if (m.role !== 'assistant') continue;
    if (reasoningByMessageId.has(m.id)) continue;
    const key = normalizeContent(m.content);
    if (key === '') continue;
    const trace = traceByContent.get(key);
    if (trace) reasoningByMessageId.set(m.id, trace);
  }
}
