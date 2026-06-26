import { describe, it, expect } from 'vitest';
import type { Message } from '@ag-ui/client';
import { sanitizeToolCallPairs } from './sanitizeToolCalls';

/** Assistant message factory; pass `toolCalls` ids via {@link tc}. */
function assistant(id: string, content: string, toolCallIds: string[] = []): Message {
  const base: Record<string, unknown> = { id, role: 'assistant', content };
  if (toolCallIds.length > 0) {
    base.toolCalls = toolCallIds.map((tcId) => ({
      id: tcId,
      type: 'function',
      function: { name: 'create_pdf', arguments: '{}' },
    }));
  }
  return base as unknown as Message;
}

function toolResult(id: string, toolCallId: string, content = 'PDF created'): Message {
  return { id, role: 'tool', content, toolCallId } as unknown as Message;
}

function user(id: string, content: string): Message {
  return { id, role: 'user', content } as unknown as Message;
}

const callIds = (messages: Message[]): string[] =>
  messages.flatMap((m) => ((m as { toolCalls?: { id: string }[] }).toolCalls ?? []).map((c) => c.id));

describe('sanitizeToolCallPairs', () => {
  it('returns the same reference when there are no tool calls', () => {
    const list = [user('u1', 'hi'), assistant('a1', 'hello')];
    expect(sanitizeToolCallPairs(list)).toBe(list);
  });

  it('keeps a fully-paired tool call (assistant declares + tool answers)', () => {
    const list = [
      user('u1', 'make a pdf'),
      assistant('a1', '', ['call_1']),
      toolResult('t1', 'call_1'),
      assistant('a2', 'Here is your PDF.'),
    ];
    const result = sanitizeToolCallPairs(list);
    expect(result).toBe(list); // nothing to change
    expect(callIds(result)).toEqual(['call_1']);
  });

  it('strips an unanswered tool_call but keeps the assistant prose', () => {
    const list = [
      user('u1', 'make a pdf'),
      assistant('a1', 'Here is your PDF.', ['call_1']), // collapsed turn, no tool answer
    ];
    const result = sanitizeToolCallPairs(list);
    expect(callIds(result)).toEqual([]); // orphan tool_call removed
    expect(result.map((m) => m.id)).toEqual(['u1', 'a1']); // prose row kept
    expect(result[1].content).toBe('Here is your PDF.');
  });

  it('drops a bare unanswered tool-call row (empty content, no surviving calls)', () => {
    const list = [
      user('u1', 'make a pdf'),
      assistant('a1', '', ['call_1']), // empty tool-call machinery row
      assistant('a2', 'Here is your PDF.'),
    ];
    const result = sanitizeToolCallPairs(list);
    expect(result.map((m) => m.id)).toEqual(['u1', 'a2']); // bare row dropped
    expect(callIds(result)).toEqual([]);
  });

  it('drops an orphan tool result that answers no surviving tool-call', () => {
    const list = [user('u1', 'hi'), toolResult('t1', 'call_ghost'), assistant('a1', 'reply')];
    const result = sanitizeToolCallPairs(list);
    expect(result.map((m) => m.id)).toEqual(['u1', 'a1']);
  });

  it('keeps the answered call and strips only the unanswered one on the same assistant', () => {
    const list = [
      user('u1', 'do two things'),
      assistant('a1', 'working', ['call_ok', 'call_orphan']),
      toolResult('t1', 'call_ok'),
    ];
    const result = sanitizeToolCallPairs(list);
    expect(callIds(result)).toEqual(['call_ok']); // only the answered call survives
    expect(result.find((m) => m.id === 't1')).toBeDefined();
  });

  it('does not mutate the input list or its messages', () => {
    const list = [user('u1', 'x'), assistant('a1', 'prose', ['call_1'])];
    const snapshot = JSON.parse(JSON.stringify(list));
    sanitizeToolCallPairs(list);
    expect(JSON.parse(JSON.stringify(list))).toEqual(snapshot);
  });

  // Regression — regenerate a generated-PDF answer (the reported scenario):
  // after truncateLocalFrom + the resend push, the outgoing history is
  // [user, assistant(create_pdf, no tool answer), newUser]. The orphaned
  // tool-call row precedes the regenerate point, so only outgoing sanitization
  // can remove it — otherwise the provider 400s on the unanswered call.
  it('regression: removes the orphaned PDF tool-call left before a regenerate resend', () => {
    const list = [
      user('u1', 'Create a one-page PDF titled Q3 Status'),
      assistant('a1', '', ['call_du4']), // collapsed create_pdf machinery, no tool answer
      user('u2', 'Create a one-page PDF titled Q3 Status'), // regenerate resend
    ];
    const result = sanitizeToolCallPairs(list);
    expect(callIds(result)).toEqual([]); // no dangling tool_call reaches the provider
    expect(result.map((m) => m.role)).toEqual(['user', 'user']);
  });
});
