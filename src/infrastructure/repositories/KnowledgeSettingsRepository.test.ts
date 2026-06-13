import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { KnowledgeSettingsRepository } from './KnowledgeSettingsRepository';

const BASE = 'http://localhost/api';
const ENDPOINT = `${BASE}/auth/me/knowledge-settings`;

const API_PAYLOAD = {
  embedding_provider: 'voyage',
  embedding_model: 'voyage-3-large',
  embedding_dimensions: 1024,
  rerank_enabled: true,
  rerank_model: 'rerank-2.5',
  chunk_max_tokens: 512,
  chunk_overlap_tokens: 64,
  search_dense_k: 50,
  search_sparse_k: 50,
  rrf_k: 60,
  rerank_candidates: 30,
  search_top_k: 8,
  cag_max_source_tokens: 180000,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new KnowledgeSettingsRepository(axios.create({ baseURL: BASE }));

describe('KnowledgeSettingsRepository', () => {
  it('get maps the snake_case payload to the camelCase domain shape', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json(API_PAYLOAD)));
    const out = await repo().get();
    expect(out).toEqual({
      embeddingProvider: 'voyage',
      embeddingModel: 'voyage-3-large',
      embeddingDimensions: 1024,
      rerankEnabled: true,
      rerankModel: 'rerank-2.5',
      chunkMaxTokens: 512,
      chunkOverlapTokens: 64,
      searchDenseK: 50,
      searchSparseK: 50,
      rrfK: 60,
      rerankCandidates: 30,
      searchTopK: 8,
      cagMaxSourceTokens: 180000,
    });
  });

  it('update PATCHes only supplied editable fields (snake_case) and maps the result', async () => {
    let body: unknown;
    server.use(
      http.patch(ENDPOINT, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...API_PAYLOAD, search_top_k: 3 });
      }),
    );
    const out = await repo().update({ searchTopK: 3, rerankEnabled: false });
    expect(body).toEqual({ search_top_k: 3, rerank_enabled: false });
    expect(out.searchTopK).toBe(3);
  });

  it('omits locked pins entirely (they are not editable)', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.patch(ENDPOINT, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(API_PAYLOAD);
      }),
    );
    await repo().update({ chunkMaxTokens: 256 });
    expect(body).toEqual({ chunk_max_tokens: 256 });
    expect(body).not.toHaveProperty('embedding_provider');
  });
});
