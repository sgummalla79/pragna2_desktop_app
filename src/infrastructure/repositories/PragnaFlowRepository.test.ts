import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PragnaFlowRepository } from './PragnaFlowRepository';

const BASE = 'http://localhost/api';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new PragnaFlowRepository(axios.create({ baseURL: BASE }));

describe('PragnaFlowRepository', () => {
  it('listSlashFlows maps the flows envelope', async () => {
    server.use(
      http.get(`${BASE}/pragna/flows`, () =>
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
    server.use(http.get(`${BASE}/pragna/flows`, () => HttpResponse.json({})));
    expect(await repo().listSlashFlows()).toEqual([]);
  });
});
