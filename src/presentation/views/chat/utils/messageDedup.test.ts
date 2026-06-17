import { describe, it, expect } from 'vitest';
import type { Message } from '@ag-ui/client';
import { pruneOrphanedOptimisticMessage } from './messageDedup';

/** Minimal message factory for the dedup unit (only id/role/content matter). */
function msg(id: string, content = id): Message {
  return { id, role: 'user', content } as unknown as Message;
}

describe('pruneOrphanedOptimisticMessage', () => {
  it('returns the list unchanged when there is no orphan id', () => {
    const list = [msg('a'), msg('b')];
    const result = pruneOrphanedOptimisticMessage(list, null);
    expect(result).toBe(list); // same reference — no copy when nothing to do
  });

  it('returns the list unchanged when the orphan id is not present', () => {
    const list = [msg('a'), msg('b')];
    const result = pruneOrphanedOptimisticMessage(list, 'missing');
    expect(result).toBe(list);
  });

  it('removes the orphaned optimistic message by id', () => {
    const list = [msg('history'), msg('orphan', 'hello'), msg('history2')];
    const result = pruneOrphanedOptimisticMessage(list, 'orphan');
    expect(result.map((m) => m.id)).toEqual(['history', 'history2']);
  });

  it('removes only the tracked orphan, never a same-content persisted copy', () => {
    // Two user messages with identical content but different ids: only the
    // tracked optimistic id is dropped, so a legitimately repeated message is
    // preserved (the fix is id-based, not content-based).
    const list = [msg('persisted', 'hello'), msg('orphan', 'hello')];
    const result = pruneOrphanedOptimisticMessage(list, 'orphan');
    expect(result.map((m) => m.id)).toEqual(['persisted']);
  });

  it('removes a trailing orphan left by a failed run', () => {
    const list = [msg('u1-be'), msg('a1-be'), msg('u2-optimistic', 'retry')];
    const result = pruneOrphanedOptimisticMessage(list, 'u2-optimistic');
    expect(result.map((m) => m.id)).toEqual(['u1-be', 'a1-be']);
  });

  it('does not mutate the input array', () => {
    const list = [msg('a'), msg('orphan')];
    pruneOrphanedOptimisticMessage(list, 'orphan');
    expect(list.map((m) => m.id)).toEqual(['a', 'orphan']);
  });
});
