import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { LlmProviderRepository } from './LlmProviderRepository';

const BASE = 'http://localhost/api';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new LlmProviderRepository(axios.create({ baseURL: BASE }));

const PROVIDER = {
  id: 'lp1',
  api_name: 'anthropic',
  display_name: 'Anthropic',
  credential_kind: 'api_key',
  enabled: true,
};

describe('LlmProviderRepository', () => {
  it('listAll maps api_name → name', async () => {
    server.use(http.get(`${BASE}/llm-providers`, () => HttpResponse.json([PROVIDER])));
    expect((await repo().listAll())[0]).toMatchObject({
      id: 'lp1',
      name: 'anthropic',
      displayName: 'Anthropic',
      credentialKind: 'api_key',
    });
  });

  it('listWithRegistrations embeds user providers + injects archived:false on embedded models', async () => {
    server.use(
      http.get(`${BASE}/llm-providers/with-registrations`, () =>
        HttpResponse.json([
          {
            ...PROVIDER,
            current_user_providers: [
              {
                id: 'up1',
                llm_provider_id: 'lp1',
                provider_api_name: 'anthropic',
                enabled: true,
                metadata: {},
                models: [
                  {
                    id: 'm1',
                    user_provider_id: 'up1',
                    api_name: 'claude',
                    display_name: 'Claude',
                    cost_per_input_token: '0',
                    cost_per_output_token: '0',
                    enabled: true,
                    available_for_chat: true,
                    available_for_flows: true,
                    metadata: {},
                  },
                ],
              },
            ],
          },
        ]),
      ),
    );
    const out = await repo().listWithRegistrations();
    expect(out[0].userProviders[0].providerName).toBe('anthropic');
    const model = out[0].userProviders[0].models[0];
    expect(model).toMatchObject({ modelName: 'claude', archived: false });
  });
});
