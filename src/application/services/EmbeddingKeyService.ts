import type { IEmbeddingKeyRepository } from '@/application/ports/IEmbeddingKeyRepository';
import type { EmbeddingKeyStatus } from '@/domain/types/embeddingKey.types';

/**
 * Application service for the per-user embedding (Voyage) key (RAG Rung 2).
 *
 * Thin pass-through over `IEmbeddingKeyRepository` — backs the
 * `/api/auth/me/embedding-key` singleton.
 */
export class EmbeddingKeyService {
  constructor(private readonly embeddingKeyRepository: IEmbeddingKeyRepository) {}

  /** Returns whether the user has a per-user embedding key set. */
  getStatus(): Promise<EmbeddingKeyStatus> {
    return this.embeddingKeyRepository.getStatus();
  }

  /** Sets/replaces the key (validated server-side via a live probe). */
  setKey(apiKey: string): Promise<EmbeddingKeyStatus> {
    return this.embeddingKeyRepository.setKey(apiKey);
  }

  /** Removes the key (embeddings fall back to the deployment key). */
  clearKey(): Promise<void> {
    return this.embeddingKeyRepository.clearKey();
  }
}
