import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { useAuthStore } from '@/presentation/store/authStore';
import { useChatSession } from './useChatSession';

/**
 * Regression — edit/regenerate orphaned tool_call (nexus-kit-tracker #230: editing a
 * message that drove a collapsed PDF tool turn 400'd the next run).
 *
 * A collapsed tool turn (e.g. create_pdf) is seeded as an assistant message that
 * carries `toolCalls` but NO paired `role:'tool'` result. The backend
 * `truncate-from` deletes that turn server-side, but the in-memory list still
 * holds it — so without `truncateLocalFrom`, the orphaned assistant tool-call is
 * re-streamed and the provider rejects it (unanswered `tool_call_id`).
 *
 * These tests assert `truncateLocalFrom` removes the orphaned turn from
 * `agent.messages` so the following `send` re-streams a clean history.
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

const THREAD_ID = 'conv-truncate';
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

/** Ids of messages still carrying tool_calls in the agent's outgoing history. */
const orphanToolCallIds = (): string[] =>
  latestAgent()
    .messages.flatMap((m) => (m.toolCalls as Array<{ id: string }> | undefined) ?? [])
    .map((c) => c.id);

const userContents = (): unknown[] =>
  latestAgent().messages.filter((m) => m.role === 'user').map((m) => m.content);

// A collapsed PDF turn: assistant carries tool_calls with NO paired role:'tool'.
const seedPdfTurn = () => [
  { id: 'u1', role: 'user', content: 'Create a one-page PDF titled Q3 Status' },
  {
    id: 'a1',
    role: 'assistant',
    content: 'Here is your PDF.',
    toolCalls: [{ id: 'call_du4', type: 'function', function: { name: 'create_pdf', arguments: '{}' } }],
  },
];

async function mountSession(initialMessages: Array<Record<string, unknown>>) {
  const { wrapper } = harness();
  const view = renderHook(
    () => useChatSession({ threadId: THREAD_ID, initialMessages: initialMessages as never }),
    { wrapper },
  );
  await act(async () => {
    await flush();
  });
  return view;
}

describe('useChatSession — truncateLocalFrom (orphaned tool_call regression)', () => {
  beforeEach(() => {
    h.instances.length = 0;
    h.subscriber = null;
    listMock.mockReset();
    listMock.mockResolvedValue({ episodes: [], limit: 1, offset: 0 });
    useAuthStore.setState({ accessToken: 'test-token' });
  });

  it('edit: truncating from the edited user message drops the orphaned PDF tool-call before re-send', async () => {
    const { result } = await mountSession(seedPdfTurn());
    // Pre-condition: the seeded collapsed turn carries the orphaned tool_call.
    expect(orphanToolCallIds()).toEqual(['call_du4']);

    // Edit flow: server truncate succeeds → mirror locally → re-send new content.
    act(() => result.current.truncateLocalFrom('u1'));
    act(() => result.current.send('Create a two-page PDF instead'));

    // The orphaned assistant tool-call is gone; only the new user turn remains.
    expect(orphanToolCallIds()).toEqual([]);
    expect(userContents()).toEqual(['Create a two-page PDF instead']);
    expect(latestAgent().runAgent).toHaveBeenCalledTimes(1);
  });

  it('regenerate: truncating from the assistant message drops its orphaned tool-call', async () => {
    const { result } = await mountSession(seedPdfTurn());

    act(() => result.current.truncateLocalFrom('a1'));
    act(() => result.current.send('Create a one-page PDF titled Q3 Status'));

    // Assistant tool-call removed; the prior user turn is preserved + the resend.
    expect(orphanToolCallIds()).toEqual([]);
    expect(userContents()).toEqual([
      'Create a one-page PDF titled Q3 Status',
      'Create a one-page PDF titled Q3 Status',
    ]);
  });

  it('keeps an EARLIER tool turn when truncating from a later message', async () => {
    const seed = [
      { id: 'u0', role: 'user', content: 'first pdf' },
      {
        id: 'a0',
        role: 'assistant',
        content: 'pdf one',
        toolCalls: [{ id: 'call_early', type: 'function', function: { name: 'create_pdf', arguments: '{}' } }],
      },
      { id: 'u1', role: 'user', content: 'second prompt' },
      { id: 'a1', role: 'assistant', content: 'plain reply' },
    ];
    const { result } = await mountSession(seed);

    act(() => result.current.truncateLocalFrom('u1'));
    act(() => result.current.send('edited second prompt'));

    // The earlier turn's tool-call stays (BE still has its rows to repair from);
    // only the truncated tail was dropped.
    expect(orphanToolCallIds()).toEqual(['call_early']);
    expect(userContents()).toEqual(['first pdf', 'edited second prompt']);
  });

  it('is a no-op when the message id is not present', async () => {
    const { result } = await mountSession(seedPdfTurn());

    act(() => result.current.truncateLocalFrom('does-not-exist'));

    // Nothing dropped — the history is untouched.
    expect(orphanToolCallIds()).toEqual(['call_du4']);
    expect(userContents()).toEqual(['Create a one-page PDF titled Q3 Status']);
  });
});
