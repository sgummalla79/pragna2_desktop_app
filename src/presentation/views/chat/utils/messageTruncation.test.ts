import { describe, it, expect } from 'vitest';
import type { Message } from '@ag-ui/client';
import { truncateMessagesFrom } from './messageTruncation';

/** Minimal message factory (only id/role/content matter for truncation). */
function msg(
  id: string,
  role: Message['role'] = 'user',
  extra: Record<string, unknown> = {},
): Message {
  return { id, role, content: id, ...extra } as unknown as Message;
}

describe('truncateMessagesFrom', () => {
  it('returns the same reference when the id is not present', () => {
    const list = [msg('a'), msg('b')];
    const result = truncateMessagesFrom(list, 'missing');
    expect(result).toBe(list); // no copy when nothing to truncate
  });

  it('drops the target message and everything after it', () => {
    const list = [msg('u1'), msg('a1', 'assistant'), msg('u2'), msg('a2', 'assistant')];
    const result = truncateMessagesFrom(list, 'u2');
    expect(result.map((m) => m.id)).toEqual(['u1', 'a1']);
  });

  it('drops everything when the target is the first message', () => {
    const list = [msg('u1'), msg('a1', 'assistant')];
    const result = truncateMessagesFrom(list, 'u1');
    expect(result).toEqual([]);
  });

  it('drops only the last message when the target is the tail', () => {
    const list = [msg('u1'), msg('a1', 'assistant')];
    const result = truncateMessagesFrom(list, 'a1');
    expect(result.map((m) => m.id)).toEqual(['u1']);
  });

  it('does not mutate the input array', () => {
    const list = [msg('u1'), msg('u2')];
    truncateMessagesFrom(list, 'u2');
    expect(list.map((m) => m.id)).toEqual(['u1', 'u2']);
  });

  // Regression — the orphaned-tool_call bug: editing the user message that drove
  // a collapsed PDF tool turn must remove the assistant tool-call WHOSE tool
  // result was never seeded, so the re-sent history carries no dangling
  // `tool_call_id`. Truncating from the edited user message id achieves this.
  it('removes an orphaned assistant tool-call when truncating from the edited user message', () => {
    const list = [
      msg('u1-create-pdf'),
      // collapsed tool turn: assistant carries tool_calls, NO paired role:'tool'
      msg('a1-pdf', 'assistant', {
        toolCalls: [{ id: 'call_du4', type: 'function', function: { name: 'create_pdf', arguments: '{}' } }],
      }),
    ];
    const result = truncateMessagesFrom(list, 'u1-create-pdf');
    expect(result).toEqual([]);
    // no surviving message carries the orphaned tool_call id
    const hasOrphan = result.some(
      (m) => (m as { toolCalls?: { id: string }[] }).toolCalls?.some((c) => c.id === 'call_du4'),
    );
    expect(hasOrphan).toBe(false);
  });

  it('keeps an EARLIER tool turn intact when truncating from a later message', () => {
    // An earlier PDF turn precedes the edited message — it stays (the BE still
    // has its rows to repair from); only the truncated tail is dropped.
    const list = [
      msg('u1'),
      msg('a1-pdf', 'assistant', {
        toolCalls: [{ id: 'call_early', type: 'function', function: { name: 'create_pdf', arguments: '{}' } }],
      }),
      msg('u2-edited'),
      msg('a2', 'assistant'),
    ];
    const result = truncateMessagesFrom(list, 'u2-edited');
    expect(result.map((m) => m.id)).toEqual(['u1', 'a1-pdf']);
  });
});
