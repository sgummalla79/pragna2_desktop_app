import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { EpisodeSnapshot, EpisodeStatus } from '@/domain/types/episode.types';
import { useSurfaceFinishedEpisode } from './useSurfaceFinishedEpisode';

const CONVERSATION_ID = 'conv-abc';
const MESSAGES_KEY = ['conversations', CONVERSATION_ID, 'messages'];

/** Minimal open-episode snapshot with the given status. */
function episode(status: EpisodeStatus): EpisodeSnapshot {
  return {
    id: 'ep-1',
    conversationId: CONVERSATION_ID,
    flowId: null,
    threadId: 'thread-1',
    status,
    seedSummary: 'long_pdf',
    seedUserInput: null,
    interruptValue: null,
    createdAt: '2026-06-22T20:02:00Z',
    modifiedAt: '2026-06-22T20:08:00Z',
    endedAt: null,
  };
}

function makeHarness() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const invalidatedMessages = () =>
    invalidateSpy.mock.calls.some(
      (c) => JSON.stringify((c[0] as { queryKey?: unknown })?.queryKey) === JSON.stringify(MESSAGES_KEY),
    );
  return { invalidatedMessages, wrapper };
}

describe('useSurfaceFinishedEpisode', () => {
  it('refetches messages when the episode leaves active (active → null)', () => {
    const { invalidatedMessages, wrapper } = makeHarness();
    const { rerender } = renderHook(
      ({ ep }: { ep: EpisodeSnapshot | null }) => useSurfaceFinishedEpisode(ep, CONVERSATION_ID),
      { wrapper, initialProps: { ep: episode('active') as EpisodeSnapshot | null } },
    );
    expect(invalidatedMessages()).toBe(false);

    // The polled open-episode query returns null once the episode is terminal.
    rerender({ ep: null });
    expect(invalidatedMessages()).toBe(true);
  });

  it('does NOT refetch while the episode stays active', () => {
    const { invalidatedMessages, wrapper } = makeHarness();
    const { rerender } = renderHook(
      ({ ep }: { ep: EpisodeSnapshot | null }) => useSurfaceFinishedEpisode(ep, CONVERSATION_ID),
      { wrapper, initialProps: { ep: episode('active') as EpisodeSnapshot | null } },
    );
    rerender({ ep: episode('active') });
    expect(invalidatedMessages()).toBe(false);
  });

  it('does NOT refetch when there was never an active episode (null → null)', () => {
    const { invalidatedMessages, wrapper } = makeHarness();
    const { rerender } = renderHook(
      ({ ep }: { ep: EpisodeSnapshot | null }) => useSurfaceFinishedEpisode(ep, CONVERSATION_ID),
      { wrapper, initialProps: { ep: null as EpisodeSnapshot | null } },
    );
    rerender({ ep: null });
    expect(invalidatedMessages()).toBe(false);
  });

  it('does not refetch when conversationId is undefined', () => {
    const { invalidatedMessages, wrapper } = makeHarness();
    const { rerender } = renderHook(
      ({ ep }: { ep: EpisodeSnapshot | null }) => useSurfaceFinishedEpisode(ep, undefined),
      { wrapper, initialProps: { ep: episode('active') as EpisodeSnapshot | null } },
    );
    rerender({ ep: null });
    expect(invalidatedMessages()).toBe(false);
  });
});
