import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Message } from '@ag-ui/client';
import { useReconcileMessages } from './useReconcileMessages';
import type { ChatMessage, ChatStatus } from './useChatSession';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function userMsg(id: string): ChatMessage {
  return { id, role: 'user', content: 'hello' };
}
function assistantMsg(id: string): ChatMessage {
  return { id, role: 'assistant', content: 'reply' };
}
function persistedMsg(id: string) {
  return { id };
}
function aguiMsg(id: string, role: 'user' | 'assistant' = 'user'): Message {
  return { id, role, content: 'x' } as unknown as Message;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useReconcileMessages', () => {
  let replaceMessages: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    replaceMessages = vi.fn();
  });

  // ── CF-013 regression ─────────────────────────────────────────────────────

  it('CF-013: does NOT replace when last in-memory message is an optimistic user message not yet persisted (status=idle)', () => {
    // Scenario: user1+assistant1 persisted; user2 pushed optimistically, run
    // not yet started. Before the fix this triggered replaceMessages(), wiping user2.
    const messages: ChatMessage[] = [userMsg('u1'), assistantMsg('a1'), userMsg('u2-optimistic')];
    const persisted = [persistedMsg('u1'), persistedMsg('a1')];
    const initialMessages = [aguiMsg('u1'), aguiMsg('a1', 'assistant')];

    renderHook(() =>
      useReconcileMessages('idle', messages, persisted, initialMessages, replaceMessages),
    );

    expect(replaceMessages).not.toHaveBeenCalled();
  });

  it('CF-013: does NOT replace when optimistic user message is the very first message (empty persisted)', () => {
    const messages: ChatMessage[] = [userMsg('u1-optimistic')];
    const persisted: { id: string }[] = [];
    const initialMessages: Message[] = [];

    renderHook(() =>
      useReconcileMessages('idle', messages, persisted, initialMessages, replaceMessages),
    );

    expect(replaceMessages).not.toHaveBeenCalled();
  });

  // ── Normal reconciliation (tool-use turn / stream id mismatch) ─────────────

  it('replaces when last message is assistant and IDs differ (stream id vs BE UUID)', () => {
    // Scenario: assistant reply streamed with a LangChain ephemeral id; persisted
    // carries the real BE UUID. Reconciliation should fire.
    const messages: ChatMessage[] = [userMsg('u1'), assistantMsg('stream-ephemeral-id')];
    const persisted = [persistedMsg('u1'), persistedMsg('be-uuid-123')];
    const initialMessages = [aguiMsg('u1'), aguiMsg('be-uuid-123', 'assistant')];

    renderHook(() =>
      useReconcileMessages('idle', messages, persisted, initialMessages, replaceMessages),
    );

    expect(replaceMessages).toHaveBeenCalledWith(initialMessages);
  });

  it('replaces when counts differ and last message is assistant', () => {
    // Scenario: a background episode added an extra assistant turn that is now
    // persisted but not yet in memory.
    const messages: ChatMessage[] = [userMsg('u1'), assistantMsg('a1')];
    const persisted = [persistedMsg('u1'), persistedMsg('a1'), persistedMsg('a2-background')];
    const initialMessages = [aguiMsg('u1'), aguiMsg('a1', 'assistant'), aguiMsg('a2-background', 'assistant')];

    renderHook(() =>
      useReconcileMessages('idle', messages, persisted, initialMessages, replaceMessages),
    );

    expect(replaceMessages).toHaveBeenCalledWith(initialMessages);
  });

  // ── Guards that must suppress replacement ─────────────────────────────────

  it('does NOT replace while status=running', () => {
    const messages: ChatMessage[] = [userMsg('u1'), assistantMsg('stream-id')];
    const persisted = [persistedMsg('u1'), persistedMsg('be-uuid')];
    const initialMessages = [aguiMsg('u1'), aguiMsg('be-uuid', 'assistant')];

    renderHook(() =>
      useReconcileMessages('running', messages, persisted, initialMessages, replaceMessages),
    );

    expect(replaceMessages).not.toHaveBeenCalled();
  });

  it('does NOT replace when in-memory list is empty', () => {
    const messages: ChatMessage[] = [];
    const persisted = [persistedMsg('u1')];
    const initialMessages = [aguiMsg('u1')];

    renderHook(() =>
      useReconcileMessages('idle', messages, persisted, initialMessages, replaceMessages),
    );

    expect(replaceMessages).not.toHaveBeenCalled();
  });

  it('does NOT replace when persisted list is empty', () => {
    const messages: ChatMessage[] = [userMsg('u1')];
    const persisted: { id: string }[] = [];
    const initialMessages: Message[] = [];

    renderHook(() =>
      useReconcileMessages('idle', messages, persisted, initialMessages, replaceMessages),
    );

    expect(replaceMessages).not.toHaveBeenCalled();
  });

  it('does NOT replace when both lists match (same count, same last id)', () => {
    const messages: ChatMessage[] = [userMsg('u1'), assistantMsg('a1')];
    const persisted = [persistedMsg('u1'), persistedMsg('a1')];
    const initialMessages = [aguiMsg('u1'), aguiMsg('a1', 'assistant')];

    renderHook(() =>
      useReconcileMessages('idle', messages, persisted, initialMessages, replaceMessages),
    );

    expect(replaceMessages).not.toHaveBeenCalled();
  });

  // ── Re-render / status transition ──────────────────────────────────────────

  it('replaces only after run finishes (running→idle transition) when IDs mismatch', () => {
    const messages: ChatMessage[] = [userMsg('u1'), assistantMsg('stream-id')];
    const persisted = [persistedMsg('u1'), persistedMsg('be-uuid')];
    const initialMessages = [aguiMsg('u1'), aguiMsg('be-uuid', 'assistant')];

    const { rerender } = renderHook(
      ({ status }: { status: ChatStatus }) =>
        useReconcileMessages(status, messages, persisted, initialMessages, replaceMessages),
      { initialProps: { status: 'running' as ChatStatus } },
    );

    expect(replaceMessages).not.toHaveBeenCalled();

    rerender({ status: 'idle' });

    expect(replaceMessages).toHaveBeenCalledWith(initialMessages);
  });
});
