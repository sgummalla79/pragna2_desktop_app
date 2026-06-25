import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AgentTemplateRepository } from './AgentTemplateRepository';

const BASE = 'http://localhost/api';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new AgentTemplateRepository(axios.create({ baseURL: BASE }));

const TEMPLATE = {
  key: 'nexus-kit-help',
  api_name: 'nexus-kit-help',
  display_name: 'Nexus Kit Help & Setup Assistant',
  description: 'Helps you set up Nexus Kit.',
  system_prompt: 'You help with setup.',
  tools: ['create_stdio_mcp_connector'],
  activatable: true,
};

const ACTIVATED = {
  id: 'a9',
  api_name: 'nexus-kit-help',
  display_name: 'Nexus Kit Help & Setup Assistant',
  description: 'Helps you set up Nexus Kit.',
  system_prompt: 'You help with setup.',
  tools: ['create_stdio_mcp_connector'],
  is_default: false,
  status: 'active',
  metadata: {},
  created_at: 'c',
  modified_at: 'm',
  created: true,
  knowledge_seeded: false,
  knowledge_note: 'No embedding key; running from built-in overview.',
};

describe('AgentTemplateRepository', () => {
  it('list maps the template rows', async () => {
    server.use(
      http.get(`${BASE}/agents/templates`, () => HttpResponse.json([TEMPLATE])),
    );
    const out = await repo().list();
    expect(out[0]).toMatchObject({
      key: 'nexus-kit-help',
      apiName: 'nexus-kit-help',
      activatable: true,
    });
  });

  it('get reads one template by key', async () => {
    server.use(
      http.get(`${BASE}/agents/templates/nexus-kit-help`, () =>
        HttpResponse.json(TEMPLATE),
      ),
    );
    expect(await repo().get('nexus-kit-help')).toMatchObject({
      key: 'nexus-kit-help',
      displayName: 'Nexus Kit Help & Setup Assistant',
    });
  });

  it('activate POSTs to the activate route and maps the result', async () => {
    let hit = false;
    server.use(
      http.post(`${BASE}/agents/templates/nexus-kit-help/activate`, () => {
        hit = true;
        return HttpResponse.json(ACTIVATED, { status: 201 });
      }),
    );
    const out = await repo().activate('nexus-kit-help');
    expect(hit).toBe(true);
    expect(out.agent).toMatchObject({ id: 'a9', apiName: 'nexus-kit-help' });
    expect(out.created).toBe(true);
    expect(out.knowledgeSeeded).toBe(false);
    expect(out.knowledgeNote).toContain('built-in overview');
  });

  it('activate maps an idempotent 200 (already activated) the same way', async () => {
    server.use(
      http.post(`${BASE}/agents/templates/nexus-kit-help/activate`, () =>
        HttpResponse.json(
          { ...ACTIVATED, created: false, knowledge_seeded: true, knowledge_note: null },
          { status: 200 },
        ),
      ),
    );
    const out = await repo().activate('nexus-kit-help');
    expect(out.created).toBe(false);
    expect(out.knowledgeSeeded).toBe(true);
    expect(out.knowledgeNote).toBeNull();
  });
});
