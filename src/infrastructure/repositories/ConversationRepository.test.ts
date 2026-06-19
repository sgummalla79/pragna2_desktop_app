import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ConversationRepository } from './ConversationRepository';

const BASE = 'http://localhost/api';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function repo() {
  return new ConversationRepository(axios.create({ baseURL: BASE }));
}

const CONV = {
  id: 'c1',
  flow_id: null,
  thread_id: 't1',
  user_model_id: 'm1',
  title: 'Hi',
  thinking_enabled: false,
  pinned: false,
  pinned_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

describe('ConversationRepository', () => {
  it('list maps the rows + forwards pagination params', async () => {
    let seen: URLSearchParams | null = null;
    server.use(
      http.get(`${BASE}/conversations`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json([CONV]);
      }),
    );
    const out = await repo().list({ limit: 10, offset: 20, pinned: true });
    expect(out[0]).toMatchObject({ id: 'c1', threadId: 't1' });
    expect(seen!.get('limit')).toBe('10');
    expect(seen!.get('offset')).toBe('20');
    expect(seen!.get('pinned')).toBe('true');
  });

  it('get maps a row, and returns null on 404', async () => {
    server.use(http.get(`${BASE}/conversations/c1`, () => HttpResponse.json(CONV)));
    expect(await repo().get('c1')).toMatchObject({ id: 'c1' });

    server.use(http.get(`${BASE}/conversations/missing`, () => new HttpResponse(null, { status: 404 })));
    expect(await repo().get('missing')).toBeNull();
  });

  it('create sends thread_id + optional fields and maps the row', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/conversations`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(CONV, { status: 201 });
      }),
    );
    await repo().create({ threadId: 't1', userModelId: 'm1', thinkingEnabled: true });
    expect(body).toEqual({ thread_id: 't1', user_model_id: 'm1', thinking_enabled: true });
  });

  it('create sends agent_id when an agent is pinned (BE #153)', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/conversations`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(CONV, { status: 201 });
      }),
    );
    await repo().create({ threadId: 't1', agentId: 'agent-7' });
    expect(body).toEqual({ thread_id: 't1', agent_id: 'agent-7' });
  });

  it('create omits agent_id when no agent is pinned (BE seeds the default)', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/conversations`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(CONV, { status: 201 });
      }),
    );
    await repo().create({ threadId: 't1' });
    expect(body).toEqual({ thread_id: 't1' });
    expect(body).not.toHaveProperty('agent_id');
  });

  it('getMessages returns [] on 404', async () => {
    server.use(http.get(`${BASE}/conversations/c1/messages`, () => new HttpResponse(null, { status: 404 })));
    expect(await repo().getMessages('c1')).toEqual([]);
  });

  it('truncateFrom posts the message_id', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/conversations/c1/messages/truncate-from`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await repo().truncateFrom('c1', 'msg9');
    expect(body).toEqual({ message_id: 'msg9' });
  });

  it('branch posts message_id and maps the new conversation', async () => {
    server.use(http.post(`${BASE}/conversations/c1/branch`, () => HttpResponse.json({ ...CONV, id: 'c2' })));
    expect(await repo().branch('c1', 'msg9')).toMatchObject({ id: 'c2' });
  });

  describe('getUsage', () => {
    it('maps the aggregate', async () => {
      server.use(
        http.get(`${BASE}/conversations/c1/usage`, () =>
          HttpResponse.json({
            conversation_id: 'c1',
            records: [],
            total_input_tokens: 7,
            total_output_tokens: 3,
            total_cost_usd: '0.01',
          }),
        ),
      );
      expect(await repo().getUsage('c1')).toMatchObject({
        conversationId: 'c1',
        totalInputTokens: 7,
        totalCostUsd: '0.01',
      });
    });

    it('returns the zero-state aggregate on 404', async () => {
      server.use(http.get(`${BASE}/conversations/c1/usage`, () => new HttpResponse(null, { status: 404 })));
      expect(await repo().getUsage('c1')).toEqual({
        conversationId: 'c1',
        records: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: '0',
      });
    });
  });
});
