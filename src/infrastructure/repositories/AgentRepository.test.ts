import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AgentRepository } from './AgentRepository';

const BASE = 'http://localhost/api';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new AgentRepository(axios.create({ baseURL: BASE }));

const AGENT = {
  id: 'a1',
  api_name: 'researcher',
  display_name: 'Researcher',
  description: null,
  system_prompt: 'p',
  tools: [],
  is_default: true,
  status: 'active',
  metadata: {},
  created_at: 'c',
  modified_at: 'm',
};

describe('AgentRepository', () => {
  it('list maps rows and adds include_archived only when true', async () => {
    let seen: URLSearchParams | null = null;
    server.use(
      http.get(`${BASE}/agents`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json([AGENT]);
      }),
    );
    await repo().list(true);
    expect(seen!.get('include_archived')).toBe('true');
    expect((await repo().list())[0]).toMatchObject({ apiName: 'researcher' });
  });

  it('getDefault returns null on 404', async () => {
    server.use(http.get(`${BASE}/agents/default`, () => new HttpResponse(null, { status: 404 })));
    expect(await repo().getDefault()).toBeNull();
  });

  it('getDefault maps the agent when present', async () => {
    server.use(http.get(`${BASE}/agents/default`, () => HttpResponse.json(AGENT)));
    expect(await repo().getDefault()).toMatchObject({ id: 'a1', isDefault: true });
  });

  it('create serialises the snake_case body with defaults', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/agents`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(AGENT, { status: 201 });
      }),
    );
    await repo().create({ apiName: 'r', displayName: 'R' });
    expect(body).toEqual({
      api_name: 'r',
      display_name: 'R',
      description: null,
      system_prompt: '',
      tools: [],
      is_default: false,
      metadata: {},
    });
  });

  it('update sends only the fields the caller set', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${BASE}/agents/a1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(AGENT);
      }),
    );
    await repo().update('a1', { displayName: 'New' });
    expect(body).toEqual({ display_name: 'New' });
  });

  it('attachConnector posts mcp_connector_id + selected_tools', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/agents/a1/connectors`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: 'b1',
          mcp_connector_id: 'mc1',
          selected_tools: null,
          created_at: 'c',
          modified_at: 'm',
        });
      }),
    );
    const out = await repo().attachConnector('a1', { mcpConnectorId: 'mc1' });
    expect(body).toEqual({ mcp_connector_id: 'mc1', selected_tools: null });
    expect(out).toMatchObject({ mcpConnectorId: 'mc1' });
  });
});
