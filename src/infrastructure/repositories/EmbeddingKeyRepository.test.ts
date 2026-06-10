import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { EmbeddingKeyRepository } from './EmbeddingKeyRepository';

const BASE = 'http://localhost/api';
const ENDPOINT = `${BASE}/auth/me/embedding-key`;
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new EmbeddingKeyRepository(axios.create({ baseURL: BASE }));

describe('EmbeddingKeyRepository', () => {
  it('getStatus maps has_voyage_key → hasVoyageKey', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ has_voyage_key: true })));
    expect(await repo().getStatus()).toEqual({ hasVoyageKey: true });
  });

  it('setKey PUTs { api_key } and maps the status', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.put(ENDPOINT, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ has_voyage_key: true });
      }),
    );
    expect(await repo().setKey('voyage-key')).toEqual({ hasVoyageKey: true });
    expect(body).toEqual({ api_key: 'voyage-key' });
  });

  it('clearKey DELETEs the endpoint', async () => {
    let hit = false;
    server.use(
      http.delete(ENDPOINT, () => {
        hit = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await repo().clearKey();
    expect(hit).toBe(true);
  });
});
