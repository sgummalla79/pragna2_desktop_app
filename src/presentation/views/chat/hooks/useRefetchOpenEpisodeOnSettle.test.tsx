import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { openEpisodeQueryKey } from '@/presentation/hooks/episodes/useEpisodes';
import { useRefetchOpenEpisodeOnSettle } from './useRefetchOpenEpisodeOnSettle';
import type { ChatStatus } from './useChatSession';

const CONVERSATION_ID = 'conv-abc';

function makeHarness() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const invalidatedKeys = () => invalidateSpy.mock.calls.map((c) => c[0]);
  return { invalidatedKeys, wrapper };
}

describe('useRefetchOpenEpisodeOnSettle', () => {
  it('invalidates the open-episode query on the running→idle transition', () => {
    const { invalidatedKeys, wrapper } = makeHarness();
    const { rerender } = renderHook(
      ({ status }: { status: ChatStatus }) => useRefetchOpenEpisodeOnSettle(status, CONVERSATION_ID),
      { wrapper, initialProps: { status: 'running' as ChatStatus } },
    );
    expect(invalidatedKeys()).not.toContainEqual({ queryKey: openEpisodeQueryKey(CONVERSATION_ID) });

    rerender({ status: 'idle' as ChatStatus });
    expect(invalidatedKeys()).toContainEqual({ queryKey: openEpisodeQueryKey(CONVERSATION_ID) });
  });

  it('invalidates on the running→error transition (run failed mid-doc-spawn)', () => {
    const { invalidatedKeys, wrapper } = makeHarness();
    const { rerender } = renderHook(
      ({ status }: { status: ChatStatus }) => useRefetchOpenEpisodeOnSettle(status, CONVERSATION_ID),
      { wrapper, initialProps: { status: 'running' as ChatStatus } },
    );
    rerender({ status: 'error' as ChatStatus });
    expect(invalidatedKeys()).toContainEqual({ queryKey: openEpisodeQueryKey(CONVERSATION_ID) });
  });

  it('does NOT invalidate on a non-running→settled transition', () => {
    const { invalidatedKeys, wrapper } = makeHarness();
    const { rerender } = renderHook(
      ({ status }: { status: ChatStatus }) => useRefetchOpenEpisodeOnSettle(status, CONVERSATION_ID),
      { wrapper, initialProps: { status: 'idle' as ChatStatus } },
    );
    rerender({ status: 'idle' as ChatStatus });
    expect(invalidatedKeys()).not.toContainEqual({ queryKey: openEpisodeQueryKey(CONVERSATION_ID) });
  });

  it('does not invalidate when conversationId is undefined', () => {
    const { invalidatedKeys, wrapper } = makeHarness();
    const { rerender } = renderHook(
      ({ status }: { status: ChatStatus }) => useRefetchOpenEpisodeOnSettle(status, undefined),
      { wrapper, initialProps: { status: 'running' as ChatStatus } },
    );
    rerender({ status: 'idle' as ChatStatus });
    expect(invalidatedKeys()).not.toContainEqual({ queryKey: openEpisodeQueryKey(undefined) });
  });
});
