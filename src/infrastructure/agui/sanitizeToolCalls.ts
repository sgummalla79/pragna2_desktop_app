import type { Message } from '@ag-ui/client';

/** Read a message's `toolCallId` (present only on `role: 'tool'` messages). */
function toolCallId(m: Message): string | undefined {
  const id = (m as { toolCallId?: unknown }).toolCallId;
  return typeof id === 'string' ? id : undefined;
}

/** Read a message's assistant `toolCalls` array, or `undefined` when absent. */
function assistantToolCalls(m: Message): Array<{ id: string }> | undefined {
  if (m.role !== 'assistant') return undefined;
  const tc = (m as { toolCalls?: unknown }).toolCalls;
  return Array.isArray(tc) ? (tc as Array<{ id: string }>) : undefined;
}

/**
 * Remove **orphaned** tool-call/tool-result pairs from an outgoing AG-UI history
 * so the provider never sees an assistant `tool_calls` without its answering tool
 * message (OpenAI 400 `invalid_request_error`: "An assistant message with
 * 'tool_calls' must be followed by tool messages responding to each
 * 'tool_call_id'").
 *
 * Why this is needed (nexus-kit-tracker #230 — edit/regenerate orphaned tool_call):
 * the chat seed (`persistedToAGUIMessage`) re-attaches an assistant turn's
 * `tool_calls` (for historical badges) but the backend persists a tool turn (e.g.
 * `create_pdf`) with its result folded **inline** into the tool-call — it returns
 * NO separate `role:'tool'` message. So every historical tool turn in the
 * in-memory history is an assistant `tool_calls` with **no answering tool
 * message**. Ordinary turns survive because the backend repairs the pairing from
 * its own checkpoint; when an edit/regenerate truncates the thread, that repair
 * source is severed at the truncation boundary and the orphaned tool-call reaches
 * the provider → 400 (surfaced in the UI as "The response could not be
 * completed…"). Regenerating a generated-PDF answer is the reported trigger: the
 * orphaned tool-call row precedes the regenerate point, so truncating from that
 * point cannot remove it — only sanitizing the outgoing payload can.
 *
 * A tool-call/result pair is **valid** only when BOTH sides are present in the
 * list: an assistant message declaring the `tool_call` id AND a `role:'tool'`
 * message answering that id. This function keeps valid pairs untouched and:
 *   - strips unanswered `tool_calls` from assistant messages (dropping the
 *     `toolCalls` field entirely when none remain),
 *   - drops a bare unanswered tool-call row (assistant with empty content and no
 *     surviving tool_calls) so no empty assistant turn is sent,
 *   - drops orphan `role:'tool'` messages that answer no surviving tool-call.
 *
 * It operates on the OUTGOING payload only (the `RunAgentInput.messages` clone),
 * never on the agent's in-memory `messages` — so historical tool-call badges keep
 * rendering in the transcript (no flicker). Pure function; returns the SAME
 * reference when nothing needs changing.
 *
 * @param messages - the outgoing AG-UI message list (a `RunAgentInput.messages`).
 * @returns a sanitized list with only fully-paired tool calls, or the same
 *   reference unchanged when every tool call is already answered.
 */
export function sanitizeToolCallPairs(messages: Message[]): Message[] {
  const answered = new Set<string>();
  const declared = new Set<string>();
  for (const m of messages) {
    const tid = toolCallId(m);
    if (tid !== undefined) answered.add(tid);
    for (const tc of assistantToolCalls(m) ?? []) declared.add(tc.id);
  }
  // A pair is valid only when declared by an assistant AND answered by a tool msg.
  const valid = new Set([...declared].filter((id) => answered.has(id)));

  let changed = false;
  const out: Message[] = [];
  for (const m of messages) {
    const tid = toolCallId(m);
    if (tid !== undefined) {
      // role:'tool' — keep only when it answers a surviving tool-call.
      if (valid.has(tid)) out.push(m);
      else changed = true;
      continue;
    }

    const tcs = assistantToolCalls(m);
    if (tcs && tcs.length > 0) {
      const kept = tcs.filter((tc) => valid.has(tc.id));
      if (kept.length === tcs.length) {
        out.push(m);
        continue;
      }
      changed = true;
      const content = typeof m.content === 'string' ? m.content : '';
      // Bare unanswered tool-call row (no prose) → drop the whole turn.
      if (kept.length === 0 && content.trim() === '') continue;
      const rest = { ...(m as Record<string, unknown>) };
      delete rest.toolCalls;
      out.push((kept.length > 0 ? { ...rest, toolCalls: kept } : rest) as Message);
      continue;
    }

    out.push(m);
  }

  return changed ? out : messages;
}
