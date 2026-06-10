import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import {
  useConversations,
  usePinnedConversations,
  useConversationUsage,
  invalidateConversationListQueries,
} from './useConversations';

function makeWrapper(conversationService: Record<string, unknown>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const services = { conversationService } as unknown as Services;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>
    </QueryClientProvider>
  );
  return { wrapper, qc };
}

describe('useConversations', () => {
  it('lists the page via conversationService.list', async () => {
    const list = vi.fn().mockResolvedValue([{ id: 'c1' }]);
    const { wrapper } = makeWrapper({ list });
    const { result } = renderHook(() => useConversations(0), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'c1' }]);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });
});

describe('usePinnedConversations', () => {
  it('requests only pinned rows', async () => {
    const list = vi.fn().mockResolvedValue([]);
    const { wrapper } = makeWrapper({ list });
    const { result } = renderHook(() => usePinnedConversations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ pinned: true }));
  });
});

describe('useConversationUsage', () => {
  it('fetches usage for a given id', async () => {
    const getUsage = vi.fn().mockResolvedValue({ conversationId: 'c1', totalCostUsd: '0.5' });
    const { wrapper } = makeWrapper({ getUsage });
    const { result } = renderHook(() => useConversationUsage('c1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUsage).toHaveBeenCalledWith('c1');
    expect(result.current.data?.totalCostUsd).toBe('0.5');
  });

  it('is disabled (no fetch) when the id is empty', async () => {
    const getUsage = vi.fn().mockResolvedValue({});
    const { wrapper } = makeWrapper({ getUsage });
    const { result } = renderHook(() => useConversationUsage(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getUsage).not.toHaveBeenCalled();
  });
});

describe('invalidateConversationListQueries', () => {
  it('matches list pages + pinned, and the named single-lookup, but not the messages subtree', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockReturnValue(Promise.resolve());
    invalidateConversationListQueries(qc, { conversationId: 'c1' });
    const { predicate } = spy.mock.calls[0][0] as { predicate: (q: { queryKey: unknown[] }) => boolean };

    expect(predicate({ queryKey: ['conversations', 0] })).toBe(true); // list page
    expect(predicate({ queryKey: ['conversations', 'pinned'] })).toBe(true); // pinned
    expect(predicate({ queryKey: ['conversations', 'c1', 'single'] })).toBe(true); // named single
    expect(predicate({ queryKey: ['conversations', 'c1', 'messages'] })).toBe(false); // messages subtree
    expect(predicate({ queryKey: ['conversations', 'other', 'single'] })).toBe(false); // a different conv
  });
});
