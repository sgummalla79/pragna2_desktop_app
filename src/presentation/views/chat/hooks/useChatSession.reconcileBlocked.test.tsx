import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { useAuthStore } from '@/presentation/store/authStore';
import { useChatSession } from './useChatSession';

/**
 * #158 (CF-029) — the `useChatSession` half of the duplicate-reply guard.
 *
 * A raw episode/delegation resume (`runEpisodeStream`) flips `status` to `'idle'`
 * in its `finally` BEFORE the `/messages` refetch resolves. If reconciliation
 * runs in that window it replaces in-memory with a stale snapshot and the BE
 * re-processes the same user message → a duplicate reply. The fix holds
 * `reconcileBlocked` true from the START of the resume until AFTER the refetch
 * lands. These tests pin that timing end-to-end through the hook.
 *
 * The OTHER half — that `useReconcileMessages` actually suppresses the replace
 * while `reconcileBlocked` is set and resumes once cleared — is covered in
 * `useReconcileMessages.test.ts`. Together they close the race.
 */

// ── Mock the agent transport: a controllable fake so we own resume timing ────
const h = vi.hoisted(() => ({ instances: [] as FakeAgentLike[] }));

interface FakeAgentLike {
  url: string;
  messages: Array<Record<string, unknown>>;
  runRaw: ReturnType<typeof vi.fn>;
  runAgent: ReturnType<typeof vi.fn>;
  setMessages: ReturnType<typeof vi.fn>;
  abortRun: ReturnType<typeof vi.fn>;
}

vi.mock('@/infrastructure/agui/TauriHttpAgent', () => {
  class FakeAgent implements FakeAgentLike {
    url: string;
    messages: Array<Record<string, unknown>>;
    runRaw = vi.fn(() => Promise.resolve());
    runAgent = vi.fn(() => Promise.resolve());
    setMessages = vi.fn((m: Array<Record<string, unknown>>) => {
      this.messages = m;
    });
    abortRun = vi.fn();
    constructor(opts: { url: string; initialMessages?: Array<Record<string, unknown>> }) {
      this.url = opts.url;
      this.messages = opts.initialMessages ?? [];
      h.instances.push(this);
    }
    subscribe() {
      return { unsubscribe: () => {} };
    }
  }
  return { TauriHttpAgent: FakeAgent };
});

// invalidateConversationListQueries is a fire-and-forget sidebar refresh — stub it.
vi.mock('@/presentation/hooks/conversations/useConversations', () => ({
  invalidateConversationListQueries: vi.fn(),
}));

// Platform stdio host is never reached on the episode-start path; stub the module.
vi.mock('@/infrastructure/platform', () => ({
  mcpStdio: { call: vi.fn() },
}));

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { error: vi.fn(), fromError: vi.fn() },
}));

const THREAD_ID = 'conv-158';

/** A page with no open episode — `resolveOpenEpisode` clears and returns. */
const listMock = vi.fn(async () => ({ episodes: [], limit: 1, offset: 0 }));

function makeServices(): Services {
  return { episodeService: { list: listMock } } as unknown as Services;
}

function harness() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={makeServices()}>{children}</ServiceContext.Provider>
    </QueryClientProvider>
  );
  return { wrapper };
}

/** Flush pending microtasks + a macrotask so awaited chains settle. */
const flush = () => new Promise((r) => setTimeout(r, 0));

function latestAgent(): FakeAgentLike {
  return h.instances[h.instances.length - 1];
}

describe('useChatSession — reconcileBlocked gate (#158)', () => {
  beforeEach(() => {
    h.instances.length = 0;
    listMock.mockClear();
    // The hook only creates the agent when an access token is present.
    useAuthStore.setState({ accessToken: 'test-token' });
  });

  it('holds reconcileBlocked TRUE for the whole episode resume, then clears after the /messages refetch settles', async () => {
    const { wrapper } = harness();
    const { result } = renderHook(() => useChatSession({ threadId: THREAD_ID }), { wrapper });

    // Idle to start — reconciliation is allowed.
    expect(result.current.reconcileBlocked).toBe(false);

    // Make the resume stream hang so we can observe the in-flight window.
    let resolveRunRaw: () => void = () => {};
    latestAgent().runRaw.mockImplementation(
      () => new Promise<void>((res) => { resolveRunRaw = res; }),
    );

    // Kick off a raw episode run (start → runEpisodeStream). Fire-and-forget.
    act(() => {
      result.current.startEpisode({ flowApiName: 'e2e-flow' });
    });

    // Mid-resume: status running AND reconciliation blocked (the #158 window).
    expect(result.current.status).toBe('running');
    expect(result.current.reconcileBlocked).toBe(true);

    // Resume completes; resolveOpenEpisode + the awaited /messages invalidate run.
    await act(async () => {
      resolveRunRaw();
      await flush();
    });

    // Settled: status idle and — crucially — the gate is released only now,
    // AFTER the refetch, so the reconciler can run against fresh persisted data.
    expect(result.current.status).toBe('idle');
    expect(result.current.reconcileBlocked).toBe(false);
  });

  it('does NOT block reconciliation for a normal chat send (only raw episode/resume paths gate)', async () => {
    const { wrapper } = harness();
    const { result } = renderHook(() => useChatSession({ threadId: THREAD_ID }), { wrapper });

    await act(async () => {
      result.current.send('hello');
      await flush();
    });

    // A plain send goes through runAgent, never runEpisodeStream — the gate stays
    // open so ordinary turns reconcile exactly as before.
    expect(result.current.reconcileBlocked).toBe(false);
    expect(latestAgent().runAgent).toHaveBeenCalledTimes(1);
  });
});
