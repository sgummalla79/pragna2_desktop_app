import type { AxiosInstance } from 'axios';
import type { IEmbeddingKeyRepository } from '@/application/ports/IEmbeddingKeyRepository';
import type { EmbeddingKeyStatus } from '@/domain/types/embeddingKey.types';

interface ApiEmbeddingKeyStatus {
  has_voyage_key: boolean;
}

const ENDPOINT = '/auth/me/embedding-key';

function mapStatus(raw: ApiEmbeddingKeyStatus): EmbeddingKeyStatus {
  return { hasVoyageKey: raw.has_voyage_key };
}

/**
 * Axios-backed implementation of `IEmbeddingKeyRepository` (RAG ladder Rung 2).
 *
 * Talks to the `/api/auth/me/embedding-key` singleton (baseURL already includes
 * `/api`). The response carries only `has_voyage_key` — never the key.
 */
export class EmbeddingKeyRepository implements IEmbeddingKeyRepository {
  constructor(private readonly http: AxiosInstance) {}

  async getStatus(): Promise<EmbeddingKeyStatus> {
    const { data } = await this.http.get<ApiEmbeddingKeyStatus>(ENDPOINT);
    return mapStatus(data);
  }

  async setKey(apiKey: string): Promise<EmbeddingKeyStatus> {
    const { data } = await this.http.put<ApiEmbeddingKeyStatus>(ENDPOINT, {
      api_key: apiKey,
    });
    return mapStatus(data);
  }

  async clearKey(): Promise<void> {
    await this.http.delete(ENDPOINT);
  }
}
