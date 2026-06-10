import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { EpisodeRepository } from './EpisodeRepository';

const BASE = 'http://localhost/api';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new EpisodeRepository(axios.create({ baseURL: BASE }));

const EP = {
  id: 'e1',
  conversation_id: 'c1',
  flow_id: 'f1',
  thread_id: 't1',
  status: 'awaiting_user',
  seed_summary: null,
  seed_user_input: null,
  interrupt_value: null,
  created_at: 'c',
  modified_at: 'm',
  ended_at: null,
};

describe('EpisodeRepository', () => {
  it('list forwards limit/offset and maps the page', async () => {
    let seen: URLSearchParams | null = null;
    server.use(
      http.get(`${BASE}/conversations/c1/episodes`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json({ episodes: [EP], limit: 1, offset: 0 });
      }),
    );
    const out = await repo().list('c1', { limit: 1, offset: 0 });
    expect(seen!.get('limit')).toBe('1');
    expect(out.episodes[0]).toMatchObject({ id: 'e1', status: 'awaiting_user' });
  });

  it('get maps a single episode', async () => {
    server.use(http.get(`${BASE}/conversations/c1/episodes/e1`, () => HttpResponse.json(EP)));
    expect(await repo().get('c1', 'e1')).toMatchObject({ id: 'e1', conversationId: 'c1' });
  });
});
