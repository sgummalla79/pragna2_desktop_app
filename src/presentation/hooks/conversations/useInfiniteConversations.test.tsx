import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useInfiniteConversations } from './useInfiniteConversations';

const conv = (id: string) => ({ id, title: `c${id}`, createdAt: '2026-06-10T00:00:00Z' });
const fullPage = (prefix: string) =>
  Array.from({ length: DEFAULT_PAGE_SIZE }, (_, i) => conv(`${prefix}-${i}`));

function setup(list: ReturnType<typeof vi.fn>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={{ conversationService: { list } } as unknown as Services}>
        {children}
      </ServiceContext.Provider>
    </QueryClientProvider>
  );
  return { wrapper };
}

describe('useInfiniteConversations', () => {
  it('loads the first page with offset 0 and flags more when a full page returns', async () => {
    const list = vi.fn().mockResolvedValue(fullPage('p0'));
    const { wrapper } = setup(list);

    const { result } = renderHook(() => useInfiniteConversations(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(list).toHaveBeenCalledWith({ limit: DEFAULT_PAGE_SIZE, offset: 0 });
    expect(result.current.data?.pages.flat()).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('fetches the next page at the right offset and stops on a short page', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce(fullPage('p0'))
      .mockResolvedValueOnce([conv('tail')]); // short page → end of data
    const { wrapper } = setup(list);

    const { result } = renderHook(() => useInfiniteConversations(), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(list).toHaveBeenLastCalledWith({ limit: DEFAULT_PAGE_SIZE, offset: DEFAULT_PAGE_SIZE });
    expect(result.current.data?.pages.flat()).toHaveLength(DEFAULT_PAGE_SIZE + 1);
  });

  it('flags no more pages when the first page is short', async () => {
    const list = vi.fn().mockResolvedValue([conv('only')]);
    const { wrapper } = setup(list);

    const { result } = renderHook(() => useInfiniteConversations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});
