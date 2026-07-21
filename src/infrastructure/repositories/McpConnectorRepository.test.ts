import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { McpConnectorRepository } from './McpConnectorRepository';

const BASE = 'http://localhost/api';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new McpConnectorRepository(axios.create({ baseURL: BASE }));

const CONN = {
  id: 'mc1',
  display_name: 'GitHub',
  description: null,
  transport: 'http',
  config: { url: 'u' },
  auth_type: 'none',
  has_credentials: false,
  status: 'active',
  tools: null,
  created_at: 'c',
  modified_at: 'm',
};

describe('McpConnectorRepository', () => {
  it('list maps connectors', async () => {
    server.use(http.get(`${BASE}/mcp-connectors`, () => HttpResponse.json([CONN])));
    expect((await repo().list())[0]).toMatchObject({ id: 'mc1', displayName: 'GitHub' });
  });

  it('register sends the create body and maps discovered tools', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/mcp-connectors`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...CONN, discovered_tool_api_names: ['a'] }, { status: 201 });
      }),
    );
    const out = await repo().register({ displayName: 'GitHub', transport: 'http', config: { url: 'u' }, authType: 'none' });
    expect(body).toMatchObject({ display_name: 'GitHub', transport: 'http', auth_type: 'none' });
    expect(out.discoveredToolApiNames).toEqual(['a']);
  });

  it('refreshTools maps the counts', async () => {
    server.use(
      http.post(`${BASE}/mcp-connectors/mc1/refresh-tools`, () =>
        HttpResponse.json({ added: 2, unchanged: 5, archived: 1 }),
      ),
    );
    expect(await repo().refreshTools('mc1')).toEqual({ added: 2, unchanged: 5, archived: 1 });
  });

  it('startOAuth maps authorization_url + requires_manual_client', async () => {
    server.use(
      http.post(`${BASE}/mcp-connectors/mc1/oauth-authorization`, () =>
        HttpResponse.json({ authorization_url: 'https://auth', requires_manual_client: false }),
      ),
    );
    expect(await repo().startOAuth('mc1', {})).toEqual({
      authorizationUrl: 'https://auth',
      requiresManualClient: false,
    });
  });

  it('completeOAuth posts code+state and maps connector_id', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/mcp-connectors/mc1/oauth-completion`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ connector_id: 'mc1' });
      }),
    );
    const out = await repo().completeOAuth('mc1', { code: 'C', state: 'S' });
    expect(body).toEqual({ code: 'C', state: 'S' });
    expect(out).toEqual({ connectorId: 'mc1' });
  });

  it('disconnectOAuth calls DELETE /mcp-connectors/{id}/oauth-tokens and resolves void', async () => {
    let called = false;
    server.use(
      http.delete(`${BASE}/mcp-connectors/mc1/oauth-tokens`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await expect(repo().disconnectOAuth('mc1')).resolves.toBeUndefined();
    expect(called).toBe(true);
  });
});
