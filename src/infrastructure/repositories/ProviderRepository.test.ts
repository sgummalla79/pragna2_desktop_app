import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ProviderRepository } from './ProviderRepository';

const BASE = 'http://localhost/api';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new ProviderRepository(axios.create({ baseURL: BASE }));

const UP = {
  id: 'up1',
  llm_provider_id: 'lp1',
  provider_api_name: 'anthropic',
  enabled: true,
  metadata: {},
};
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

describe('ProviderRepository', () => {
  it('list maps provider_api_name → providerName', async () => {
    server.use(http.get(`${BASE}/user-providers`, () => HttpResponse.json([UP])));
    expect((await repo().list())[0]).toMatchObject({ id: 'up1', providerName: 'anthropic' });
  });

  it('register posts llm_provider_id + api_key and maps provider+models', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/user-providers`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ provider: UP, models: [MODEL] });
      }),
    );
    const out = await repo().register({ llmProviderId: 'lp1', apiKey: 'sk-x' });
    expect(body).toEqual({ llm_provider_id: 'lp1', api_key: 'sk-x' });
    expect(out.provider).toMatchObject({ providerName: 'anthropic' });
    expect(out.models[0]).toMatchObject({ modelName: 'claude' });
  });

  it('refreshModels maps every bucket', async () => {
    server.use(
      http.post(`${BASE}/user-providers/up1/refresh-models`, () =>
        HttpResponse.json({ created: [MODEL], archived: [], unarchived: [], models: [MODEL] }),
      ),
    );
    const out = await repo().refreshModels('up1');
    expect(out.created[0]).toMatchObject({ modelName: 'claude' });
    expect(out.models).toHaveLength(1);
  });

  it('toggle patches enabled', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${BASE}/user-providers/up1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...UP, enabled: false });
      }),
    );
    const out = await repo().toggle('up1', false);
    expect(body).toEqual({ enabled: false });
    expect(out.enabled).toBe(false);
  });
});
