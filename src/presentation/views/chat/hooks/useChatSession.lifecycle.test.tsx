import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { useAuthStore } from '@/presentation/store/authStore';
import { useChatSession } from './useChatSession';

/**
 * #160 — core state machine of the chat session hook, exercised WITHOUT a Tauri
 * window by capturing the `AgentSubscriber` the hook installs and firing its
 * callbacks directly (the mock transport never auto-fires them). Covers issue
 * #160 Group 1 (basic send/receive lifecycle), Group 5 (message streaming
 * lifecycle), and Group 6 (progress label). Groups 2/4 live in sibling files
 * (`orphanPrune`, `reauth`); Group 3 (#158 delegation) in
 * `delegationRoundtrip` / `reconcileBlocked`.
 */

interface AgentSubscriberLike {
  onRunInitialized: () => void;
  onRunFailed: (p: { error: Error }) => void;
  onRunErrorEvent: (p: { event: { code?: string; message?: string } }) => void;
  onRunFinalized: () => void;
  onTextMessageStartEvent: (p: { event: { messageId: string } }) => void;
  onTextMessageContentEvent: () => void;
  onTextMessageEndEvent: (p: { event: { messageId: string } }) => void;
  onToolCallStartEvent: (p: { event: { toolCallId: string; toolCallName: string } }) => void;
  onToolCallEndEvent: (p: { event: { toolCallId: string }; toolCallArgs: unknown }) => void;
  onCustomEvent: (p: { event: { name: string; value: unknown } }) => void;
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

const THREAD_ID = 'conv-lifecycle';
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

async function mountSession() {
  const { wrapper } = harness();
  const view = renderHook(() => useChatSession({ threadId: THREAD_ID, initialMessages: [] as never }), {
    wrapper,
  });
  // Let the mount-triggered open-episode lookup settle (resolves to none).
  await act(async () => {
    await flush();
  });
  return view;
}

describe('useChatSession — lifecycle / streaming / progress (#160)', () => {
  beforeEach(() => {
    h.instances.length = 0;
    h.subscriber = null;
    listMock.mockReset();
    listMock.mockResolvedValue({ episodes: [], limit: 1, offset: 0 });
    useAuthStore.setState({ accessToken: 'test-token' });
  });

  // ── Group 1: basic send/receive lifecycle ─────────────────────────────────
  it('send() pushes an optimistic user message and runs the agent (status stays idle until init)', async () => {
    const { result } = await mountSession();

    act(() => result.current.send('hello'));

    expect(latestAgent().runAgent).toHaveBeenCalledTimes(1);
    const users = result.current.messages.filter((m) => m.role === 'user');
    expect(users).toHaveLength(1);
    expect(users[0].content).toBe('hello');
    // send() itself does not flip status — only onRunInitialized does.
    expect(result.current.status).toBe('idle');
  });

  it('send() trims and ignores blank input', async () => {
    const { result } = await mountSession();
    act(() => result.current.send('   '));
    expect(latestAgent().runAgent).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it('onRunInitialized flips status to running; send() is a no-op while running', async () => {
    const { result } = await mountSession();
    act(() => result.current.send('hi'));
    await act(async () => {
      sub().onRunInitialized();
    });
    expect(result.current.status).toBe('running');

    act(() => result.current.send('again'));
    // Still one run, still one user message — the second send was suppressed.
    expect(latestAgent().runAgent).toHaveBeenCalledTimes(1);
    expect(result.current.messages.filter((m) => m.role === 'user')).toHaveLength(1);
  });

  it('onRunFinalized returns status to idle', async () => {
    const { result } = await mountSession();
    act(() => result.current.send('hi'));
    await act(async () => sub().onRunInitialized());
    expect(result.current.status).toBe('running');
    await act(async () => sub().onRunFinalized());
    expect(result.current.status).toBe('idle');
  });

  it('onRunFailed sets status=error and surfaces the message', async () => {
    const { result } = await mountSession();
    act(() => result.current.send('hi'));
    await act(async () => sub().onRunFailed({ error: new Error('LLM exploded') }));
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('LLM exploded');
  });

  it('onRunFailed with an AbortError resets silently to idle (CF-006)', async () => {
    const { result } = await mountSession();
    act(() => result.current.send('hi'));
    await act(async () => sub().onRunInitialized());
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    await act(async () => sub().onRunFailed({ error: abort }));
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('onRunErrorEvent (terminal RUN_ERROR) surfaces like a failure, but a code=abort unwinds silently', async () => {
    const { result } = await mountSession();
    act(() => result.current.send('hi'));
    await act(async () => sub().onRunErrorEvent({ event: { message: 'model 400' } }));
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('model 400');

    // A client-side abort arrives as RUN_ERROR code 'abort' → silent idle.
    await act(async () => sub().onRunErrorEvent({ event: { code: 'abort', message: '' } }));
    expect(result.current.status).toBe('idle');
  });

  // ── Group 5: message streaming lifecycle ──────────────────────────────────
  it('text start adds the message id to streamingMessageIds; end removes it', async () => {
    const { result } = await mountSession();
    await act(async () => sub().onTextMessageStartEvent({ event: { messageId: 'a1' } }));
    expect(result.current.streamingMessageIds.has('a1')).toBe(true);
    await act(async () => sub().onTextMessageEndEvent({ event: { messageId: 'a1' } }));
    expect(result.current.streamingMessageIds.has('a1')).toBe(false);
  });

  it('tool-call start then end marks the merged ChatToolCall complete with its final args', async () => {
    const { result } = await mountSession();
    await act(async () => {
      latestAgent().messages.push({
        id: 'a1',
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'tc1', function: { name: 'search', arguments: '' } }],
      });
      sub().onToolCallStartEvent({ event: { toolCallId: 'tc1', toolCallName: 'search' } });
    });
    const mid = result.current.messages.find((m) => m.id === 'a1');
    expect(mid?.toolCalls?.[0].complete).toBe(false);

    await act(async () =>
      sub().onToolCallEndEvent({ event: { toolCallId: 'tc1' }, toolCallArgs: { query: 'x' } }),
    );
    const done = result.current.messages.find((m) => m.id === 'a1');
    expect(done?.toolCalls?.[0].complete).toBe(true);
    expect(done?.toolCalls?.[0].args).toEqual({ query: 'x' });
  });

  it('a model_attribution event is snapshotted onto the next streaming message id', async () => {
    const { result } = await mountSession();
    await act(async () => {
      sub().onCustomEvent({ event: { name: 'model_attribution', value: { model_entity_id: 'm-99' } } });
      sub().onTextMessageStartEvent({ event: { messageId: 'a1' } });
    });
    expect(result.current.streamingModelByMessageId.get('a1')).toBe('m-99');
  });

  it('a reasoning_content event stamps the thinking trace onto its message', async () => {
    const { result } = await mountSession();
    await act(async () => {
      latestAgent().messages.push({ id: 'a1', role: 'assistant', content: 'answer' });
      sub().onTextMessageStartEvent({ event: { messageId: 'a1' } });
      sub().onCustomEvent({
        event: { name: 'reasoning_content', value: { message_id: 'a1', reasoning: 'let me think' } },
      });
    });
    expect(result.current.messages.find((m) => m.id === 'a1')?.reasoning).toBe('let me think');
  });

  // ── Group 6: progress label ───────────────────────────────────────────────
  it('on_progress sets progressLabel and onRunFinalized clears it', async () => {
    const { result } = await mountSession();
    await act(async () =>
      sub().onCustomEvent({ event: { name: 'on_progress', value: { label: 'Searching…' } } }),
    );
    expect(result.current.progressLabel).toBe('Searching…');
    await act(async () => sub().onRunFinalized());
    expect(result.current.progressLabel).toBeNull();
  });
});
