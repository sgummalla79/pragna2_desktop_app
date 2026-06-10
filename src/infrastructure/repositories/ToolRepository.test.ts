import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ToolRepository } from './ToolRepository';

const BASE = 'http://localhost/api';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new ToolRepository(axios.create({ baseURL: BASE }));

const TOOL = {
  id: 't1',
  user_id: 'u1',
  mcp_connector_id: null,
  api_name: 'web_search',
  display_name: 'Web Search',
  description: '',
  tool_type: 'builtin',
  handler_family: null,
  system_managed: false,
  auto_bind_to_default_agent: true,
  enabled: false,
  created_at: 'c',
  modified_at: 'm',
};

describe('ToolRepository', () => {
  it('list maps tools', async () => {
    server.use(http.get(`${BASE}/tools`, () => HttpResponse.json([TOOL])));
    expect((await repo().list())[0]).toMatchObject({ apiName: 'web_search', enabled: false });
  });

  it('setEnabled patches the enabled flag', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${BASE}/tools/t1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...TOOL, enabled: true });
      }),
    );
    const out = await repo().setEnabled('t1', { enabled: true });
    expect(body).toEqual({ enabled: true });
    expect(out.enabled).toBe(true);
  });
});
