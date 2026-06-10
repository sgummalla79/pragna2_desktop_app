import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import {
  useDeleteConversation,
  useRenameConversation,
  useTruncateFromMessage,
  useBranchConversation,
} from './useConversationMutations';

function setup(conversationService: Record<string, unknown>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const services = { conversationService } as unknown as Services;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>
    </QueryClientProvider>
  );
  return { wrapper, qc };
}

describe('useRenameConversation', () => {
  it('updates the title and invalidates list queries', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'c1' });
    const { wrapper, qc } = setup({ update });
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRenameConversation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'c1', title: 'New' });
    });
    expect(update).toHaveBeenCalledWith('c1', { title: 'New' });
    expect(invalidate).toHaveBeenCalled();
  });
});

describe('useDeleteConversation', () => {
  it('cancels the per-conversation queries before deleting, then invalidates only list keys', async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    const { wrapper, qc } = setup({ delete: del });
    const cancel = vi.spyOn(qc, 'cancelQueries').mockReturnValue(Promise.resolve());
    const invalidate = vi.spyOn(qc, 'invalidateQueries').mockReturnValue(Promise.resolve());

    const { result } = renderHook(() => useDeleteConversation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('c1');
    });

    expect(cancel).toHaveBeenCalledWith({ queryKey: ['conversations', 'c1'] });
    expect(del).toHaveBeenCalledWith('c1');

    // onSuccess invalidates ONLY length-2 conversation list keys.
    const { predicate } = invalidate.mock.calls.at(-1)![0] as {
      predicate: (q: { queryKey: unknown[] }) => boolean;
    };
    expect(predicate({ queryKey: ['conversations', 0] })).toBe(true);
    expect(predicate({ queryKey: ['conversations', 'c1', 'messages'] })).toBe(false);
  });
});

describe('useTruncateFromMessage', () => {
  it('truncates then invalidates the message log for that conversation', async () => {
    const truncateFrom = vi.fn().mockResolvedValue(undefined);
    const { wrapper, qc } = setup({ truncateFrom });
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useTruncateFromMessage(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ conversationId: 'c1', messageId: 'm9' });
    });
    expect(truncateFrom).toHaveBeenCalledWith('c1', 'm9');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['conversations', 'c1', 'messages'] });
  });
});

describe('useBranchConversation', () => {
  it('forks via branch and returns the new conversation', async () => {
    const branch = vi.fn().mockResolvedValue({ id: 'c2' });
    const { wrapper } = setup({ branch });
    const { result } = renderHook(() => useBranchConversation(), { wrapper });
    let fork: { id: string } | undefined;
    await act(async () => {
      fork = await result.current.mutateAsync({ conversationId: 'c1', messageId: 'm9' });
    });
    expect(branch).toHaveBeenCalledWith('c1', 'm9');
    expect(fork).toEqual({ id: 'c2' });
  });
});
