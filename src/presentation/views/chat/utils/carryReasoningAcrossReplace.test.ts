import { describe, it, expect } from 'vitest';
import type { Message } from '@ag-ui/client';
import { carryReasoningAcrossReplace } from './carryReasoningAcrossReplace';

/** Minimal message factory (only id/role/content matter here). */
function msg(
  id: string,
  role: Message['role'] = 'assistant',
  content = '',
): Message {
  return { id, role, content } as unknown as Message;
}

describe('carryReasoningAcrossReplace', () => {
  it('re-keys the trace from the stream-id message onto the persisted BE-UUID message', () => {
    const prev = [msg('user-1', 'user', 'hi'), msg('stream-1', 'assistant', 'The answer.')];
    const replacement = [msg('user-1', 'user', 'hi'), msg('be-uuid-1', 'assistant', 'The answer.')];
    const trace = new Map([['stream-1', 'thinking…']]);

    carryReasoningAcrossReplace(prev, replacement, trace);

    expect(trace.get('be-uuid-1')).toBe('thinking…');
  });

  it('pairs by whitespace-normalised content (tolerates differing whitespace)', () => {
    const prev = [msg('stream-1', 'assistant', 'Line one\n\n  Line two')];
    const replacement = [msg('be-1', 'assistant', 'Line one Line two')];
    const trace = new Map([['stream-1', 'r']]);

    carryReasoningAcrossReplace(prev, replacement, trace);

    expect(trace.get('be-1')).toBe('r');
  });

  it('leaves an existing trace on the replacement id untouched (idempotent)', () => {
    const prev = [msg('a', 'assistant', 'same')];
    const replacement = [msg('a', 'assistant', 'same')];
    const trace = new Map([['a', 'original']]);

    carryReasoningAcrossReplace(prev, replacement, trace);

    expect(trace.get('a')).toBe('original');
  });

  it('does not pair contentless assistant turns (empty content never matches)', () => {
    const prev = [msg('stream-1', 'assistant', '')];
    const replacement = [msg('be-1', 'assistant', '')];
    const trace = new Map([['stream-1', 'r']]);

    carryReasoningAcrossReplace(prev, replacement, trace);

    expect(trace.has('be-1')).toBe(false);
  });

  it('only carries onto assistant replacement messages', () => {
    const prev = [msg('stream-1', 'assistant', 'echo')];
    // A persisted tool message that happens to share content must not receive a trace.
    const replacement = [msg('be-tool', 'tool', 'echo')];
    const trace = new Map([['stream-1', 'r']]);

    carryReasoningAcrossReplace(prev, replacement, trace);

    expect(trace.has('be-tool')).toBe(false);
  });

  it('ignores stream messages that have no trace', () => {
    const prev = [msg('stream-1', 'assistant', 'answer')];
    const replacement = [msg('be-1', 'assistant', 'answer')];
    const trace = new Map<string, string>(); // empty — nothing to carry

    carryReasoningAcrossReplace(prev, replacement, trace);

    expect(trace.size).toBe(0);
  });

  it('first stream-side trace wins for duplicate content (no overwrite by a later turn)', () => {
    const prev = [
      msg('stream-1', 'assistant', 'dup'),
      msg('stream-2', 'assistant', 'dup'),
    ];
    const replacement = [msg('be-1', 'assistant', 'dup')];
    const trace = new Map([
      ['stream-1', 'first'],
      ['stream-2', 'second'],
    ]);

    carryReasoningAcrossReplace(prev, replacement, trace);

    expect(trace.get('be-1')).toBe('first');
  });

  it('matches each persisted turn to its own trace across a multi-turn history', () => {
    const prev = [
      msg('s1', 'assistant', 'first answer'),
      msg('s2', 'assistant', 'second answer'),
    ];
    const replacement = [
      msg('be1', 'assistant', 'first answer'),
      msg('be2', 'assistant', 'second answer'),
    ];
    const trace = new Map([
      ['s1', 'reason-1'],
      ['s2', 'reason-2'],
    ]);

    carryReasoningAcrossReplace(prev, replacement, trace);

    expect(trace.get('be1')).toBe('reason-1');
    expect(trace.get('be2')).toBe('reason-2');
  });
});
