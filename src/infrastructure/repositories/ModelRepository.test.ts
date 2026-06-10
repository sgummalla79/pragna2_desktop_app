import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ModelRepository } from './ModelRepository';

const BASE = 'http://localhost/api';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new ModelRepository(axios.create({ baseURL: BASE }));

const MODEL = {
  id: 'm1',
  user_provider_id: 'up1',
  api_name: 'claude',
  display_name: 'Claude',
  cost_per_input_token: '0',
  cost_per_output_token: '0',
  enabled: true,
  available_for_chat: true,
  available_for_flows: true,
  archived: false,
  metadata: {},
};

describe('ModelRepository', () => {
  it('list maps from /user-models', async () => {
    server.use(http.get(`${BASE}/user-models`, () => HttpResponse.json([MODEL])));
    expect((await repo().list())[0]).toMatchObject({ modelName: 'claude' });
  });

  it('update sends only set fields (camel→snake)', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${BASE}/user-models/m1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(MODEL);
      }),
    );
    await repo().update('m1', { enabled: false, availableForChat: true });
    expect(body).toEqual({ enabled: false, available_for_chat: true });
  });

  it('bulkUpdate wraps entries under { updates: [...] } with snake_case bodies', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${BASE}/user-models`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([MODEL]);
      }),
    );
    await repo().bulkUpdate([{ id: 'm1', availableForFlows: false }]);
    expect(body).toEqual({ updates: [{ id: 'm1', available_for_flows: false }] });
  });
});
