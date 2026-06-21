import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { useAuthStore } from '@/presentation/store/authStore';
import { useChatSession } from './useChatSession';

/**
 * #160 Group 4 — the connector re-auth pause (pragna2-tracker #124/#2). An open
 * `awaiting_user` episode whose `interrupt_value` carries a `connector_reauth`
 * envelope surfaces as `pendingReauth` (a card, not a headless delegation).
 * `submitReauth('retry'|'continue')` clears the pause and resumes the run via
 * `/resume-reauth` with the chosen action.
 */

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
  lastRaw: null as null | { url: string; body: unknown },
}));

vi.mock('@/infrastructure/agui/TauriHttpAgent', () => {
  class FakeAgent implements FakeAgentLike {
    url: string;
    messages: Array<Record<string, unknown>>;
    runRaw = vi.fn((url: string, body: unknown) => {
      h.lastRaw = { url, body };
      return Promise.resolve();
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

vi.mock('@/infrastructure/platform', () => ({
  mcpStdio: { call: vi.fn(async () => ({ kind: 'result', content: 'ok' })) },
}));
vi.mock('@/presentation/hooks/conversations/useConversations', () => ({
  invalidateConversationListQueries: vi.fn(),
}));
vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { error: vi.fn(), fromError: vi.fn() },
}));

const THREAD_ID = 'conv-reauth';

/** An open episode paused on a downstream-service (aggregator) re-auth (#124). */
const REAUTH_EPISODE = {
  id: 'ep-9',
  status: 'awaiting_user',
  interruptValue: {
    connector_reauth: {
      connector_id: 'c1',
      display_name: 'GUS',
      auth_type: 'oauth2',
      reason: 'token_expired',
      boundary: 'downstream_service',
      transport: 'stdio',
      service: 'gus',
      resume_actions: ['retry', 'continue'],
    },
  },
};

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

async function mountWithOpenReauth() {
  const { wrapper } = harness();
  const view = renderHook(() => useChatSession({ threadId: THREAD_ID, initialMessages: [] as never }), {
    wrapper,
  });
  // Mount-triggered open-episode lookup resolves the re-auth pause.
  await act(async () => {
    await flush();
  });
  return view;
}

describe('useChatSession — connector re-auth pause (#160 / #124)', () => {
  beforeEach(() => {
    h.instances.length = 0;
    h.lastRaw = null;
    listMock.mockReset();
    // First lookup returns the re-auth pause; after the resume the episode is
    // settled, so subsequent lookups return none (no recurse loop).
    listMock
      .mockResolvedValueOnce({ episodes: [REAUTH_EPISODE], limit: 1, offset: 0 })
      .mockResolvedValue({ episodes: [], limit: 1, offset: 0 });
    useAuthStore.setState({ accessToken: 'test-token' });
  });

  it('an open connector_reauth episode surfaces as pendingReauth', async () => {
    const { result } = await mountWithOpenReauth();
    expect(result.current.pendingReauth).not.toBeNull();
    expect(result.current.pendingReauth?.episodeId).toBe('ep-9');
    expect(result.current.pendingReauth?.envelope.service).toBe('gus');
  });

  it("submitReauth('retry') clears the pause and resumes via /resume-reauth with action=retry", async () => {
    const { result } = await mountWithOpenReauth();
    expect(result.current.pendingReauth).not.toBeNull();

    await act(async () => {
      result.current.submitReauth('retry');
      await flush();
    });

    expect(result.current.pendingReauth).toBeNull();
    expect(h.lastRaw?.url).toContain('/episodes/ep-9/resume-reauth');
    expect(h.lastRaw?.body).toEqual({ action: 'retry' });
    expect(result.current.status).toBe('idle');
  });

  it("submitReauth('continue') resumes with action=continue (skip + degrade)", async () => {
    const { result } = await mountWithOpenReauth();

    await act(async () => {
      result.current.submitReauth('continue');
      await flush();
    });

    expect(result.current.pendingReauth).toBeNull();
    expect(h.lastRaw?.url).toContain('/episodes/ep-9/resume-reauth');
    expect(h.lastRaw?.body).toEqual({ action: 'continue' });
  });
});
