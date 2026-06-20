import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { useAuthStore } from '@/presentation/store/authStore';
import { useChatSession } from './useChatSession';

/**
 * #158 (CF-029) — the client-delegated (stdio) round-trip, end-to-end through the
 * hook, deterministically and WITHOUT a Tauri window.
 *
 * This is issue #158's "regression test #2": drive a real delegation round-trip
 * (open-episode → `runDelegation` → local tool via `mcpStdio` → resume via
 * `runEpisodeStream`) and assert the turn stays intact — exactly one user message
 * and one reply, the local tool ran with the envelope's args, the resume posts the
 * ordered results to `/resume-tool`, and the `reconcileBlocked` gate is held for
 * the whole resume then released. The stdio path only executes in the Tauri
 * runtime in production, so a browser e2e cannot cover it; mocking the `mcpStdio`
 * bridge here exercises the exact orchestration deterministically. The reconciler
 * half of the gate is pinned in `useReconcileMessages.test.ts`; the gate timing
 * via the `startEpisode` path in `useChatSession.reconcileBlocked.test.tsx`.
 */

// ── Controllable agent transport: runRaw stays pending until the test resolves it.
const h = vi.hoisted(() => ({
  instances: [] as FakeAgentLike[],
  resolveRunRaw: null as null | (() => void),
  lastResume: null as null | { url: string; body: unknown },
}));

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
    // Pending by default so the resume window stays open until the test resolves it.
    runRaw = vi.fn((url: string, body: unknown) => {
      h.lastResume = { url, body };
      return new Promise<void>((res) => {
        h.resolveRunRaw = res;
      });
    });
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

// The local stdio host: return a normal result outcome.
const mcpCall = vi.fn(async () => ({ kind: 'result', content: 'TOOL_OK' }));
vi.mock('@/infrastructure/platform', () => ({
  mcpStdio: { call: (...args: unknown[]) => mcpCall(...args) },
}));

vi.mock('@/presentation/hooks/conversations/useConversations', () => ({
  invalidateConversationListQueries: vi.fn(),
}));
vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { error: vi.fn(), fromError: vi.fn() },
}));

const THREAD_ID = 'conv-deleg';

/** A delegation pause carrying one stdio tool call. */
const DELEGATION_EPISODE = {
  id: 'ep-1',
  status: 'awaiting_user',
  interruptValue: {
    mcp_tool_delegation: {
      calls: [
        {
          connector_id: 'c1',
          tool_api_name: 'mock.search',
          upstream_name: 'search',
          args: { query: 'x' },
          tool_call_id: 'tc1',
        },
      ],
    },
  },
};

// First open-episode lookup returns the delegation pause; after the resume the
// episode is settled, so subsequent lookups return none (prevents a recurse loop).
const listMock = vi.fn();

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

const flush = () => new Promise((r) => setTimeout(r, 0));
const latestAgent = (): FakeAgentLike => h.instances[h.instances.length - 1];

describe('useChatSession — client-delegated round-trip (#158)', () => {
  beforeEach(() => {
    h.instances.length = 0;
    h.resolveRunRaw = null;
    h.lastResume = null;
    mcpCall.mockClear();
    listMock.mockReset();
    listMock
      .mockResolvedValueOnce({ episodes: [DELEGATION_EPISODE], limit: 1, offset: 0 })
      .mockResolvedValue({ episodes: [], limit: 1, offset: 0 });
    useAuthStore.setState({ accessToken: 'test-token' });
  });

  it('runs the local tool, resumes with the ordered result, holds the gate, and keeps one user + one reply', async () => {
    const { wrapper } = harness();
    const { result } = renderHook(
      () => useChatSession({ threadId: THREAD_ID, initialMessages: [{ id: 'u1', role: 'user', content: 'hi' }] as never }),
      { wrapper },
    );

    // Let the mount-triggered open-episode lookup drive runDelegation → the local
    // tool call → runEpisodeStream (which now hangs on the pending runRaw).
    await act(async () => {
      await flush();
    });

    // The local stdio tool ran with the envelope's call args.
    expect(mcpCall).toHaveBeenCalledWith('c1', 'search', { query: 'x' });

    // The resume posts the ordered results to /resume-tool — the success outcome
    // becomes a single `tool_result` (no re-sent user turn, no extra calls).
    expect(h.lastResume?.url).toContain('/episodes/ep-1/resume-tool');
    expect(h.lastResume?.body).toEqual({ results: [{ tool_result: 'TOOL_OK' }] });

    // Mid-resume: the gate is held shut and the run is in flight.
    expect(result.current.reconcileBlocked).toBe(true);
    expect(result.current.status).toBe('running');

    // The resume stream completes (emitting the reply); the run settles.
    await act(async () => {
      latestAgent().messages.push({ id: 'a1', role: 'assistant', content: 'done' });
      h.resolveRunRaw?.();
      await flush();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.reconcileBlocked).toBe(false);

    // Exactly one user message and one assistant reply — no duplication across the
    // delegation round-trip (the #158 symptom was a duplicated user turn + reply).
    const msgs = latestAgent().messages;
    expect(msgs.filter((m) => m.role === 'user')).toHaveLength(1);
    expect(msgs.filter((m) => m.role === 'assistant')).toHaveLength(1);

    // The tool was delegated exactly once.
    expect(mcpCall).toHaveBeenCalledTimes(1);
  });
});
