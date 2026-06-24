import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PragnaFlowRepository } from './PragnaFlowRepository';
import { CHAT_API_PATH } from '@/constants/api';

const BASE = 'http://localhost/api';
// The discovery path is brand-configurable (CHAT_API_PATH), so assert against it
// rather than a hardcoded `/pragna` — keeps the test correct for any BE prefix.
const FLOWS_URL = `${BASE}${CHAT_API_PATH}/flows`;
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new PragnaFlowRepository(axios.create({ baseURL: BASE }));

describe('PragnaFlowRepository', () => {
  it('listSlashFlows maps the flows envelope', async () => {
    server.use(
      http.get(FLOWS_URL, () =>
        HttpResponse.json({
          flows: [{ slash_api_name: 'research', display_name: 'Research', description: 'go' }],
        }),
      ),
    );
    expect(await repo().listSlashFlows()).toEqual([
      { slashApiName: 'research', displayName: 'Research', description: 'go' },
    ]);
  });

  it('defaults to [] when the envelope omits flows', async () => {
    server.use(http.get(FLOWS_URL, () => HttpResponse.json({})));
    expect(await repo().listSlashFlows()).toEqual([]);
  });
});
