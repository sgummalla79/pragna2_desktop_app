/**
 * Axios-backed implementation of `IKnowledgeSettingsRepository` (RAG Rung 2).
 *
 * Talks to the `/api/auth/me/knowledge-settings` singleton. The API uses
 * snake_case; this maps to/from the camelCase domain shape. PATCH is a partial
 * merge — only the editable fields present in the update are sent.
 */

import type { AxiosInstance } from 'axios';
import type { IKnowledgeSettingsRepository } from '@/application/ports/IKnowledgeSettingsRepository';
import type {
  KnowledgeSettings,
  KnowledgeSettingsUpdate,
} from '@/domain/types/knowledgeSettings.types';

interface ApiKnowledgeSettings {
  embedding_provider: string;
  embedding_model: string;
  embedding_dimensions: number;
  rerank_enabled: boolean;
  rerank_model: string;
  chunk_max_tokens: number;
  chunk_overlap_tokens: number;
  search_dense_k: number;
  search_sparse_k: number;
  rrf_k: number;
  rerank_candidates: number;
  search_top_k: number;
  cag_max_source_tokens: number;
}

const ENDPOINT = '/auth/me/knowledge-settings';

function mapFromApi(raw: ApiKnowledgeSettings): KnowledgeSettings {
  return {
    embeddingProvider: raw.embedding_provider,
    embeddingModel: raw.embedding_model,
    embeddingDimensions: raw.embedding_dimensions,
    rerankEnabled: raw.rerank_enabled,
    rerankModel: raw.rerank_model,
    chunkMaxTokens: raw.chunk_max_tokens,
    chunkOverlapTokens: raw.chunk_overlap_tokens,
    searchDenseK: raw.search_dense_k,
    searchSparseK: raw.search_sparse_k,
    rrfK: raw.rrf_k,
    rerankCandidates: raw.rerank_candidates,
    searchTopK: raw.search_top_k,
    cagMaxSourceTokens: raw.cag_max_source_tokens,
  };
}

/** Map the camelCase editable fields present in a patch to their snake_case keys. */
function mapToApi(patch: KnowledgeSettingsUpdate): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.embeddingModel !== undefined) out.embedding_model = patch.embeddingModel;
  if (patch.chunkMaxTokens !== undefined) out.chunk_max_tokens = patch.chunkMaxTokens;
  if (patch.chunkOverlapTokens !== undefined)
    out.chunk_overlap_tokens = patch.chunkOverlapTokens;
  if (patch.rerankEnabled !== undefined) out.rerank_enabled = patch.rerankEnabled;
  if (patch.rerankModel !== undefined) out.rerank_model = patch.rerankModel;
  if (patch.searchDenseK !== undefined) out.search_dense_k = patch.searchDenseK;
  if (patch.searchSparseK !== undefined) out.search_sparse_k = patch.searchSparseK;
  if (patch.rrfK !== undefined) out.rrf_k = patch.rrfK;
  if (patch.rerankCandidates !== undefined)
    out.rerank_candidates = patch.rerankCandidates;
  if (patch.searchTopK !== undefined) out.search_top_k = patch.searchTopK;
  if (patch.cagMaxSourceTokens !== undefined)
    out.cag_max_source_tokens = patch.cagMaxSourceTokens;
  return out;
}

export class KnowledgeSettingsRepository implements IKnowledgeSettingsRepository {
  constructor(private readonly http: AxiosInstance) {}

  async get(): Promise<KnowledgeSettings> {
    const { data } = await this.http.get<ApiKnowledgeSettings>(ENDPOINT);
    return mapFromApi(data);
  }

  async update(patch: KnowledgeSettingsUpdate): Promise<KnowledgeSettings> {
    const { data } = await this.http.patch<ApiKnowledgeSettings>(
      ENDPOINT,
      mapToApi(patch),
    );
    return mapFromApi(data);
  }
}
