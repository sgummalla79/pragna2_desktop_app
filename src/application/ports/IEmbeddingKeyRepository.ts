/**
 * Port for the per-user embedding (Voyage) key (RAG ladder Rung 2).
 *
 * Backs the `/api/auth/me/embedding-key` singleton. The key itself never leaves
 * the server in the clear — these methods only set/clear it and read whether one
 * is present.
 */

import type { EmbeddingKeyStatus } from '@/domain/types/embeddingKey.types';

export interface IEmbeddingKeyRepository {
  /** Whether a per-user key is set. Maps to `GET /api/auth/me/embedding-key`. */
  getStatus(): Promise<EmbeddingKeyStatus>;

  /**
   * Set/replace the key (validated by a live probe server-side). Maps to
   * `PUT /api/auth/me/embedding-key`. Returns the new status.
   */
  setKey(apiKey: string): Promise<EmbeddingKeyStatus>;

  /**
   * Remove the key (embeddings fall back to the deployment key). Maps to
   * `DELETE /api/auth/me/embedding-key` (204).
   */
  clearKey(): Promise<void>;
}
