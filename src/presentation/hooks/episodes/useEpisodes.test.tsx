import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import type { EpisodeSnapshot } from '@/domain/types/episode.types';
import { useOpenEpisode } from './useEpisodes';

function snap(over: Partial<EpisodeSnapshot> = {}): EpisodeSnapshot {
  return {
    id: 'ep1',
    conversationId: 'c1',
    status: 'active',
    seedSummary: null,
    interruptValue: null,
    ...over,
  } as EpisodeSnapshot;
}

function wrap(list: ReturnType<typeof vi.fn>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={{ episodeService: { list } } as unknown as Services}>
        {children}
      </ServiceContext.Provider>
    </QueryClientProvider>
  );
}

describe('useOpenEpisode', () => {
  it('returns the most-recent episode when it is active', async () => {
    const list = vi.fn().mockResolvedValue({ episodes: [snap({ status: 'active' })] });
    const { result } = renderHook(() => useOpenEpisode('c1'), { wrapper: wrap(list) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('ep1');
    expect(list).toHaveBeenCalledWith('c1', { limit: 1, offset: 0 });
  });

  it('returns null when the most-recent episode is closed', async () => {
    const list = vi.fn().mockResolvedValue({ episodes: [snap({ status: 'completed' })] });
    const { result } = renderHook(() => useOpenEpisode('c1'), { wrapper: wrap(list) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('returns null on a 404 (delete/navigate race) rather than erroring', async () => {
    const err = new AxiosError('not found');
    err.response = { status: 404 } as never;
    const list = vi.fn().mockRejectedValue(err);
    const { result } = renderHook(() => useOpenEpisode('c1'), { wrapper: wrap(list) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('is disabled (does not fetch) when conversationId is undefined', () => {
    const list = vi.fn();
    const { result } = renderHook(() => useOpenEpisode(undefined), { wrapper: wrap(list) });
    expect(list).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
