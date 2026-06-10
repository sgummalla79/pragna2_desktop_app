import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { KnowledgeRepository } from './KnowledgeRepository';

const BASE = 'http://localhost/api';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new KnowledgeRepository(axios.create({ baseURL: BASE }));

const LIB = {
  id: 'l1',
  slug: 'kb',
  name: 'KB',
  description: null,
  embedding_model: 'e',
  embedding_dimensions: 1536,
  status: 'ready',
  created_at: 'c',
  modified_at: 'm',
};
const SRC = {
  id: 's1',
  library_id: 'l1',
  slug: 'doc',
  display_name: 'Doc',
  summary: null,
  token_count: 1,
  content_hash: 'h',
  source_attachment_id: null,
  status: 'ready',
  created_at: 'c',
  modified_at: 'm',
};

describe('KnowledgeRepository', () => {
  it('listLibraries maps rows', async () => {
    server.use(http.get(`${BASE}/knowledge-libraries`, () => HttpResponse.json([LIB])));
    expect((await repo().listLibraries())[0]).toMatchObject({ slug: 'kb', embeddingDimensions: 1536 });
  });

  it('createLibrary posts the snake_case create body', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/knowledge-libraries`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(LIB, { status: 201 });
      }),
    );
    await repo().createLibrary({ slug: 'kb', name: 'KB', description: 'd' });
    expect(body).toEqual({ slug: 'kb', name: 'KB', description: 'd' });
  });

  it('ingestSource maps displayName→display_name', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/knowledge-libraries/l1/sources`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(SRC, { status: 201 });
      }),
    );
    await repo().ingestSource('l1', { slug: 'doc', displayName: 'Doc', text: 'hi' });
    expect(body).toEqual({ slug: 'doc', display_name: 'Doc', text: 'hi' });
  });

  it('uploadSource posts to the upload endpoint and maps the response', async () => {
    let hit = false;
    server.use(
      http.post(`${BASE}/knowledge-libraries/l1/sources/upload`, () => {
        hit = true;
        return HttpResponse.json(SRC, { status: 201 });
      }),
    );
    const file = new File(['data'], 'doc.txt', { type: 'text/plain' });
    const out = await repo().uploadSource('l1', { slug: 'doc', displayName: 'Doc', file });
    expect(hit).toBe(true);
    expect(out).toMatchObject({ id: 's1', displayName: 'Doc' });
  });

  it('attachAgentLibrary posts { library_id }', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/agents/a1/knowledge-libraries`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: 'b1',
          agent_id: 'a1',
          library_id: 'l1',
          library_name: 'KB',
          library_slug: 'kb',
          created_at: 'c',
          modified_at: 'm',
        });
      }),
    );
    await repo().attachAgentLibrary('a1', { libraryId: 'l1' });
    expect(body).toEqual({ library_id: 'l1' });
  });
});
