import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { useAuthStore } from '@/presentation/store/authStore';
import { useChatSession } from './useChatSession';

/**
 * #160 Group 2 — the orphan-prune guard (pragna2-tracker #111). A FAILED run
 * leaves its optimistic user message in `agent.messages` (it was never persisted
 * / reconciled). The NEXT `send` must prune that orphan before pushing the new
 * turn, so the same user message is never re-sent in the outgoing history. A
 * SUCCEEDED run clears the guard, so its (soon-reconciled) message is kept.
 */

interface AgentSubscriberLike {
  onRunInitialized: () => void;
  onRunFailed: (p: { error: Error }) => void;
  onRunFinalized: () => void;
}

interface FakeAgentLike {
  url: string;
  messages: Array<Record<string, unknown>>;
  runAgent: ReturnType<typeof vi.fn>;
  runRaw: ReturnType<typeof vi.fn>;
  setMessages: ReturnType<typeof vi.fn>;
  abortRun: ReturnType<typeof vi.fn>;
}

const h = vi.hoisted(() => ({
  instances: [] as FakeAgentLike[],
  subscriber: null as null | AgentSubscriberLike,
}));

vi.mock('@/infrastructure/agui/TauriHttpAgent', () => {
  class FakeAgent implements FakeAgentLike {
    url: string;
    messages: Array<Record<string, unknown>>;
    runAgent = vi.fn(() => Promise.resolve());
    runRaw = vi.fn(() => Promise.resolve());
    setMessages = vi.fn((m: Array<Record<string, unknown>>) => {
      this.messages = m;
    });
    abortRun = vi.fn();
    constructor(opts: { url: string; initialMessages?: Array<Record<string, unknown>> }) {
      this.url = opts.url;
      this.messages = opts.initialMessages ?? [];
      h.instances.push(this);
    }
    subscribe(subscriber: AgentSubscriberLike) {
      h.subscriber = subscriber;
      return { unsubscribe: () => {} };
    }
  }
  return { TauriHttpAgent: FakeAgent };
});

vi.mock('@/infrastructure/platform', () => ({
  mcpStdio: { call: vi.fn(async () => ({ kind: 'result', content: 'ok' })) },
}));
vi.mock('@/presentation/hooks/conversations/useConversations', () => ({
  invalidateConversationListQueries: vi.fn(),
}));
vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { error: vi.fn(), fromError: vi.fn() },
}));

const THREAD_ID = 'conv-orphan';
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
const sub = (): AgentSubscriberLike => {
  if (!h.subscriber) throw new Error('subscriber not installed');
  return h.subscriber;
};
const userContents = (): unknown[] =>
  latestAgent().messages.filter((m) => m.role === 'user').map((m) => m.content);

async function mountSession() {
  const { wrapper } = harness();
  const view = renderHook(() => useChatSession({ threadId: THREAD_ID, initialMessages: [] as never }), {
    wrapper,
  });
  await act(async () => {
    await flush();
  });
  return view;
}

describe('useChatSession — orphan-prune guard (#160 / #111)', () => {
  beforeEach(() => {
    h.instances.length = 0;
    h.subscriber = null;
    listMock.mockReset();
    listMock.mockResolvedValue({ episodes: [], limit: 1, offset: 0 });
    useAuthStore.setState({ accessToken: 'test-token' });
  });

  it('a failed run leaves the optimistic user message; the next send prunes it before pushing the new one', async () => {
    const { result } = await mountSession();

    act(() => result.current.send('first'));
    await act(async () => sub().onRunFailed({ error: new Error('network down') }));
    // The failed turn's optimistic message is still present.
    expect(userContents()).toEqual(['first']);

    act(() => result.current.send('second'));
    // The orphan 'first' was pruned; only the new turn remains in the history.
    expect(userContents()).toEqual(['second']);
  });

  it('a succeeded run does NOT prune — its reconciled message is kept', async () => {
    const { result } = await mountSession();

    act(() => result.current.send('first'));
    await act(async () => {
      sub().onRunInitialized();
      latestAgent().messages.push({ id: 'a1', role: 'assistant', content: 'reply' });
      sub().onRunFinalized();
    });

    act(() => result.current.send('second'));
    // No prune: both user turns survive (the first was reconciled, not orphaned).
    expect(userContents()).toEqual(['first', 'second']);
  });

  it('two failed runs back-to-back: only the latest orphan lingers (each send prunes the prior)', async () => {
    const { result } = await mountSession();

    act(() => result.current.send('first'));
    await act(async () => sub().onRunFailed({ error: new Error('boom 1') }));

    act(() => result.current.send('second'));
    await act(async () => sub().onRunFailed({ error: new Error('boom 2') }));

    act(() => result.current.send('third'));
    // 'first' pruned at the 'second' send, 'second' pruned at the 'third' send.
    expect(userContents()).toEqual(['third']);
  });
});
